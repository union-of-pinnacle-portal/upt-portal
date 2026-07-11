import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import {
  TableV2,
  AttributeType,
  Billing,
} from 'aws-cdk-lib/aws-dynamodb';

/**
 * DataStack — the single DynamoDB table backing the whole portal.
 *
 * Single-table design: Users, Documents, MagicLinks, Sessions and download
 * logs all live in one table, distinguished by key prefix (USER#, DOC#,
 * TOKEN#, SESSION#, LOG#). See the README for the full data model.
 */
export class DataStack extends cdk.Stack {
  /** Exposed so a future app stack can grant read/write on the table. */
  public readonly table: TableV2;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.table = new TableV2(this, 'PortalTable', {
      // Explicit name so a CDK/construct version bump never triggers a
      // table replacement (which would drop all data).
      tableName: 'upt-portal',
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
      // Pay-per-request: right for spiky, low-volume volunteer traffic.
      billing: Billing.onDemand(),
      // Continuous backups for point-in-time restore.
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      // TTL: DynamoDB auto-deletes expired magic-link tokens and sessions
      // whose `expiresAt` (epoch seconds) has passed.
      timeToLiveAttribute: 'expiresAt',
      // SECURITY/SAFETY: never delete the table on stack teardown.
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      globalSecondaryIndexes: [
        {
          // Serves the role-based document list: query documents whose
          // minRank a member is allowed to see, newest first.
          indexName: 'by-rank',
          partitionKey: { name: 'minRank', type: AttributeType.NUMBER },
          sortKey: { name: 'updatedAt', type: AttributeType.STRING },
        },
      ],
    });
  }
}
