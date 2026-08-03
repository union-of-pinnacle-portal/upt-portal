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
| **Document**      | `DOC#<id>`        | `DOC#<id>`                  | `title`, `description`, `category`, `minRank` (`1` \| `2` \| `3`), `status` (`draft` \| `published` \| `archived`), `storageKey` (S3 object key), `originalFilename`, `contentType`, `sizeBytes`, `uploadedBy`, `createdAt`, `updatedAt` |
| **MagicLink**     | `TOKEN#<token>`   | `TOKEN#<token>`             | `email`, `used`, `expiresAt` (epoch seconds, TTL) |
| **Session**       | `SESSION#<id>`    | `SESSION#<id>`              | `email`, `expiresAt` (epoch seconds, TTL) |
| **Download log**  | `DOC#<id>`        | `LOG#<timestamp>#<email>`   | `email` |

The `by-rank` GSI is populated by Document items (which carry `minRank` and
`updatedAt`); other entity types omit those attributes and so do not appear in
the index.

## S3 bucket (`upt-portal-documents`)

- **Public access:** `BLOCK_ALL` — never public; access is via presigned URLs
- **Encryption:** S3-managed (SSE-S3)
- **Versioning:** enabled
- **Removal policy:** `RETAIN`

Document objects are referenced from DynamoDB via the Document item's
`storageKey`.
