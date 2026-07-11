import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import {
  Bucket,
  BlockPublicAccess,
  BucketEncryption,
  HttpMethods,
} from 'aws-cdk-lib/aws-s3';

/**
 * StorageStack — the single private S3 bucket that holds document files.
 *
 * The bucket is never public: the app serves objects exclusively through
 * short-lived presigned URLs, so all public access is blocked at the bucket
 * level. A future app/compute stack can grant scoped access via `bucket`.
 */
export class StorageStack extends cdk.Stack {
  /** Exposed so a future app stack can grant read/write on the documents bucket. */
  public readonly bucket: Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.bucket = new Bucket(this, 'DocumentsBucket', {
      bucketName: 'upt-portal-documents',
      // SECURITY: block every form of public access. Files are only ever
      // reachable through short-lived presigned URLs minted by the app.
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      // Encrypt objects at rest with S3-managed keys (SSE-S3).
      encryption: BucketEncryption.S3_MANAGED,
      // Keep prior versions so an overwrite or delete is recoverable.
      versioned: true,
      // SECURITY/SAFETY: never delete member documents on stack teardown.
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      // Browsers upload directly to S3 via presigned PUT URLs (and may fetch via
      // presigned GET). CORS only governs which origins the browser lets script
      // read the response from — it grants NO access; every request is still
      // authorized by the presigned signature, which is minted only by the
      // app's admin-gated endpoint. So a permissive origin is safe here and
      // avoids enumerating Vercel's dynamic preview-deployment URLs.
      cors: [
        {
          allowedOrigins: ['*'],
          allowedMethods: [HttpMethods.PUT, HttpMethods.GET],
          allowedHeaders: ['*'],
          exposedHeaders: ['ETag'],
          maxAge: 3000,
        },
      ],
    });
  }
}
