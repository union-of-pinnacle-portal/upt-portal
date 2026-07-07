import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import {
  Bucket,
  BlockPublicAccess,
  BucketEncryption,
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
    });
  }
}
