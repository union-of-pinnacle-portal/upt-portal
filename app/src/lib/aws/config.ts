/**
 * Central AWS configuration for the portal.
 *
 * Resource names default to the values provisioned by the CDK stacks in
 * `infra/` (table `upt-portal`, bucket `upt-portal-documents`, GSI `by-rank`)
 * but can be overridden per-environment. Credentials are NEVER read here — the
 * AWS SDK's default provider chain resolves them from the standard
 * `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (and optional session token)
 * environment variables on Vercel, or the local profile in development.
 */

/** AWS region hosting the DynamoDB table and S3 bucket. */
export const AWS_REGION = process.env.AWS_REGION ?? "us-east-1";

/** DynamoDB single-table name (see infra/DataStack). */
export const TABLE_NAME = process.env.PORTAL_TABLE_NAME ?? "upt-portal";

/** GSI that serves the role-based document list (minRank / updatedAt). */
export const BY_RANK_INDEX = "by-rank";

/** Private S3 bucket holding document files (see infra/StorageStack). */
export const DOCUMENTS_BUCKET =
  process.env.PORTAL_DOCUMENTS_BUCKET ?? "upt-portal-documents";
