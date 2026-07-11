import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { User } from 'aws-cdk-lib/aws-iam';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { Bucket } from 'aws-cdk-lib/aws-s3';

/**
 * AccessStack — the IAM identity the Next.js app (hosted on Vercel) uses to
 * reach the portal's data stores.
 *
 * The app authenticates to AWS with a long-lived access key belonging to this
 * user. The user is granted the minimum it needs: read/write on the DynamoDB
 * table (and its `by-rank` GSI) and get/put on document objects in the private
 * S3 bucket — nothing else, and no access to any other AWS resource.
 *
 * SECURITY: the access key is intentionally NOT created here, so its secret
 * never lands in CloudFormation state or stack outputs. Mint it out of band
 * after deploy and store the values in the app environment (see infra/README):
 *
 *   aws iam create-access-key --user-name upt-portal-app
 */
export class AccessStack extends cdk.Stack {
  /** The IAM user the app authenticates as. */
  public readonly appUser: User;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Reference the existing stateful resources by name. They live in the
    // Storage/Data stacks with RemovalPolicy.RETAIN, so their names are stable
    // identifiers and we avoid cross-stack export coupling.
    const table = Table.fromTableAttributes(this, 'PortalTable', {
      tableName: 'upt-portal',
      // Extends grants to `${tableArn}/index/*` so the app may Query the
      // by-rank GSI, not only the base table.
      grantIndexPermissions: true,
    });
    const bucket = Bucket.fromBucketName(
      this,
      'DocumentsBucket',
      'upt-portal-documents',
    );

    this.appUser = new User(this, 'AppUser', { userName: 'upt-portal-app' });

    // DynamoDB: Get/Put/Query/Update/Delete on the table and its indexes.
    table.grantReadWriteData(this.appUser);
    // S3: download (GetObject) and upload (PutObject) document objects. No
    // delete — archiving a document leaves its object in place.
    bucket.grantRead(this.appUser);
    bucket.grantPut(this.appUser);

    new cdk.CfnOutput(this, 'AppUserName', {
      value: this.appUser.userName,
      description:
        'IAM user for the app. Mint its access key with: ' +
        'aws iam create-access-key --user-name upt-portal-app',
    });
  }
}
