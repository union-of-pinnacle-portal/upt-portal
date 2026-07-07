# upt-portal — infrastructure

AWS CDK v2 (TypeScript) app defining the **stateful** resources for the UPT
tenants-union member portal. This package owns only durable data stores; it
deliberately contains no compute, hosting, or app code.

Two stacks:

| Stack                    | Resource                                              |
| ------------------------ | ----------------------------------------------------- |
| `UptPortalStorageStack`  | Private S3 bucket `upt-portal-documents` for uploads  |
| `UptPortalDataStack`     | DynamoDB table `upt-portal` (single-table design)     |

Both stacks use `RemovalPolicy.RETAIN` — destroying a stack leaves the bucket
and table (and their data) in place. The bucket blocks all public access; the
app serves files only through short-lived presigned URLs. The table has
point-in-time recovery and a TTL on `expiresAt`.

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

# 4. Deploy both stacks
npx cdk deploy --all
```

Other useful commands:

```bash
npm test              # run the jest assertion tests
npm run build         # type-check / compile
npx cdk diff --all    # compare deployed state with local
```

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

### Item types

| Entity            | pk                | sk                          | Fields |
| ----------------- | ----------------- | --------------------------- | ------ |
| **User**          | `USER#<email>`    | `USER#<email>`              | `email`, `name`, `role` (`general` \| `contributor` \| `committee_head`), `rank` (`1` \| `2` \| `3`), `createdAt`, `lastLoginAt` |
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
