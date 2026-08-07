# upt-portal — infrastructure

AWS CDK v2 (TypeScript) app defining the backend resources for the UPT
tenants-union member portal — the durable data stores plus the IAM identity the
app uses to reach them. It deliberately contains no compute or hosting (the app
runs on Vercel).

Three stacks:

| Stack                    | Resource                                              |
| ------------------------ | ----------------------------------------------------- |
| `UptPortalStorageStack`  | Private S3 bucket `upt-portal-documents` for uploads  |
| `UptPortalDataStack`     | DynamoDB table `upt-portal` (single-table design)     |
| `UptPortalAccessStack`   | IAM user `upt-portal-app` scoped to the table+bucket  |

The storage and data stacks use `RemovalPolicy.RETAIN` — destroying a stack
leaves the bucket and table (and their data) in place. The bucket blocks all
public access; the app serves files only through short-lived presigned URLs.
The table has point-in-time recovery and a TTL on `expiresAt`.

`UptPortalAccessStack` references the table and bucket **by name**, so deploy it
after the other two exist. It grants its IAM user the minimum the app needs
(read/write on the table + `by-rank` GSI; get/put on document objects) and
nothing else. See [App credentials](#app-credentials) for how to mint its key.

## Prerequisites

- Node.js and npm
- AWS credentials available via your **local AWS profile** (e.g.
  `aws configure` / `AWS_PROFILE`). The CDK reads account & region from that
  profile; `bin/portal.ts` picks them up via `CDK_DEFAULT_ACCOUNT` /
  `CDK_DEFAULT_REGION`.

## Commands

```bash
# 1. Install dependencies
npm install

# 2. One-time per account/region: provision the CDK toolkit resources
npx cdk bootstrap

# 3. Synthesize CloudFormation (no AWS changes) — good for review
npx cdk synth

# 4. Deploy all stacks (Access references the table/bucket by name, so the
#    others must exist — `--all` deploys them in dependency order)
npx cdk deploy --all
```

Other useful commands:

```bash
npm test              # run the jest assertion tests
npm run build         # type-check / compile
npx cdk diff --all    # compare deployed state with local
```

## App credentials

The app (on Vercel) authenticates to AWS as the `upt-portal-app` IAM user
created by `UptPortalAccessStack`. The access **key** is intentionally not
created by CDK, so its secret never lands in CloudFormation state or outputs.
Mint it once, out of band, after deploying:

```bash
aws iam create-access-key --user-name upt-portal-app
```

This prints an `AccessKeyId` and a `SecretAccessKey` (the secret is shown only
this once). Set them, plus the region and resource names, in the app's
environment (Vercel → Project → Settings → Environment Variables):

| Env var                    | Value                                  |
| -------------------------- | -------------------------------------- |
| `AWS_ACCESS_KEY_ID`        | the `AccessKeyId` from the command     |
| `AWS_SECRET_ACCESS_KEY`    | the `SecretAccessKey` from the command |
| `AWS_REGION`               | the region the stacks deployed to      |
| `PORTAL_TABLE_NAME`        | `upt-portal` (default; override only if renamed)      |
| `PORTAL_DOCUMENTS_BUCKET`  | `upt-portal-documents` (default; override if renamed) |

To rotate: create a new access key, update Vercel, then delete the old one with
`aws iam delete-access-key --user-name upt-portal-app --access-key-id <old>`.

## Data model (DynamoDB `upt-portal`)

Single table, single-table design. Every item lives under a composite key
(`pk`, `sk`); the **key prefix** identifies the entity type. Do not seed data
here — this package only provisions the table.

- **Keys:** `pk` (STRING), `sk` (STRING)
- **Billing:** on-demand (pay-per-request)
- **TTL:** `expiresAt` (epoch seconds) — DynamoDB auto-deletes expired tokens
  and sessions
- **GSI `by-rank`:** `minRank` (NUMBER) / `updatedAt` (STRING) — serves the
  role-based document list query (documents a member's rank may view, newest
  first)

### Access levels

Four levels, ascending. Read access is global and rank-based: a user sees any
document whose `minRank` is at or below their own rank. The **stored role
strings differ from the display names** (they predate the current naming and are
kept as-is to avoid migrating live user records) — see `app/src/lib/roles.ts`.

| Rank | Stored role       | Display name     |
| ---- | ----------------- | ---------------- |
| 1    | `general`         | General Member   |
| 2    | `contributor`     | Committee Member |
| 3    | `committee_chair` | Committee Chair  |
| 4    | `committee_head`  | Super User       |

Rank 3 was previously the top level (Super User). Documents written before
Committee Chair existed carry `minRank: 3` meaning "Super Users only" and must
be rewritten to `4` — see `app/scripts/migrate-minrank-3-to-4.js`.

### Item types

| Entity            | pk                | sk                          | Fields |
| ----------------- | ----------------- | --------------------------- | ------ |
| **User**          | `USER#<email>`    | `USER#<email>`              | `email`, `name`, `role` (`general` \| `contributor` \| `committee_chair` \| `committee_head`), `rank` (`1`–`4`), `createdAt`, `lastLoginAt` |
| **Document**      | `DOC#<id>`        | `DOC#<id>`                  | `title`, `description`, `categories` (string list of canonical category names; pre-multi-category items instead carry a single free-text `category`), `roomId` (optional), `minRank` (`1`–`4`), `status` (`draft` \| `published` \| `archived`), `storageKey` (S3 object key), `originalFilename`, `contentType`, `sizeBytes`, `uploadedBy`, `createdAt`, `updatedAt` |
| **Committee Room**| `ROOMS`           | `ROOM#<id>`                 | `id`, `name`, `description`, `createdBy`, `createdAt` |
| **Category**      | `CATEGORIES`      | `CAT#<key>`                 | `name` (display), `key` (lower-cased `name` — the case-insensitive identity), `createdBy`, `createdAt`. Created inline by anyone who may upload; seed with `npm run seed-categories`. |
| **Membership**    | `USER#<email>`    | `ROOM#<id>`                 | `roomId`, `email`, `assignedBy`, `assignedAt` |
| **Membership** (mirror) | `ROOM#<id>` | `MEMBER#<email>`            | same attributes — see note below |
| **Edit lock**     | `DOC#<id>`        | `LOCK`                      | `heldBy` (email), `expiresAt` (epoch seconds, TTL). Advisory only — see below. |
| **File version**  | `DOC#<id>`        | `VER#<zero-padded number>`  | `documentId`, `version`, `storageKey`, `originalFilename`, `contentType`, `sizeBytes`, `uploadedBy`, `uploadedAt`. Written only when a file is replaced — see below. |
| **MagicLink**     | `TOKEN#<token>`   | `TOKEN#<token>`             | `email`, `used`, `expiresAt` (epoch seconds, TTL) |
| **Session**       | `SESSION#<id>`    | `SESSION#<id>`              | `email`, `expiresAt` (epoch seconds, TTL) |
| **Download log**  | `DOC#<id>`        | `LOG#<timestamp>#<email>`   | `email` |

The `by-rank` GSI is populated by Document items (which carry `minRank` and
`updatedAt`); other entity types omit those attributes and so do not appear in
the index — Room and Membership items included.

### Committee Rooms

A room scopes **writes**, never reads. Membership decides who may upload or edit
documents filed to that room; what a user can *see* is decided solely by their
rank (above), in every room at once. A document with no `roomId` is "unfiled"
and writable only by Super Users — that covers documents created before rooms
existed.

Two storage details worth knowing before changing this:

- **All rooms share the `ROOMS` partition**, so listing them is one Query with
  no extra GSI. A union has a handful of committees, so the usual hot-partition
  warning does not apply at this scale.
- **Memberships are written twice**, under both `USER#<email>` and
  `ROOM#<id>`, in a single `TransactWriteItems` call. Both directions are
  needed — per-user for the authorization check on every write, per-room for the
  roster UI — and the transaction is what keeps them from disagreeing. Any code
  that writes a membership must write both, or the two views drift.

### Document kinds

A Document is one of two kinds, carried in its `kind` attribute:

- **`file`** — an uploaded file (Word, PDF, …). Read by downloading it.
- **`page`** — written in the portal with the built-in editor, either created
  there or converted from an uploaded `.docx`.

Everything else — rank visibility, Committee Room, categories, status, version
history — is identical for both. **A missing `kind` means `file`**, so existing
documents need no migration.

A page's body is **stored in S3, not DynamoDB**, at the document's `storageKey`.
The reason is the document list: `listVisibleForUser` returns whole items, so a
body on the Document item would make every dashboard load fetch the full text of
every document the viewer can see. S3 also sidesteps the 400 KB item limit.

### Edit locks

Editing a page takes an **advisory** lease (`sk = LOCK`) with an `expiresAt` the
table's existing TTL reaps. It stops two people unknowingly typing into the same
document — **it is not authorization**, and saves are deliberately not refused
when a lease lapses, because discarding real work to uphold a hint is the wrong
trade. Permission remains `canWriteInRoom`.

TTL deletion is not prompt, so reads compare `expiresAt` themselves and treat a
stale row as absent — TTL is the janitor, not the clock.

### File versions

A document's file can be replaced and nothing is ever overwritten: each
replacement is its own S3 object under `documents/<id>/v<n>/<name>`, and the
Document item is repointed at it. Saving a page document is the same mechanism,
so edit history and file history are one feature.

**Version 1 has no stored item.** A document never replaced is its own version
1, synthesized from the Document item. It is written for real the first time the
file is replaced — otherwise repointing would lose the only record of where the
original bytes live. Version items therefore start at 2, and numbers are
zero-padded because DynamoDB sorts sort keys lexicographically.

## S3 bucket (`upt-portal-documents`)

- **Public access:** `BLOCK_ALL` — never public; access is via presigned URLs
- **Encryption:** S3-managed (SSE-S3)
- **Versioning:** enabled
- **Removal policy:** `RETAIN`

Document objects are referenced from DynamoDB via the Document item's
`storageKey`.
