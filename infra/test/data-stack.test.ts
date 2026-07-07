import * as cdk from 'aws-cdk-lib/core';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { DataStack } from '../lib/data-stack';

test('portal table has the pk/sk key schema and on-demand billing', () => {
  const app = new cdk.App();
  const stack = new DataStack(app, 'TestDataStack');
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::DynamoDB::GlobalTable', {
    TableName: 'upt-portal',
    BillingMode: 'PAY_PER_REQUEST',
    KeySchema: [
      { AttributeName: 'pk', KeyType: 'HASH' },
      { AttributeName: 'sk', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: Match.arrayWith([
      { AttributeName: 'pk', AttributeType: 'S' },
      { AttributeName: 'sk', AttributeType: 'S' },
    ]),
  });
});

test('portal table has the by-rank GSI (minRank / updatedAt)', () => {
  const app = new cdk.App();
  const stack = new DataStack(app, 'TestDataStack');
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::DynamoDB::GlobalTable', {
    GlobalSecondaryIndexes: Match.arrayWith([
      Match.objectLike({
        IndexName: 'by-rank',
        KeySchema: [
          { AttributeName: 'minRank', KeyType: 'HASH' },
          { AttributeName: 'updatedAt', KeyType: 'RANGE' },
        ],
      }),
    ]),
    // GSI key attributes must be declared: minRank is NUMBER, updatedAt STRING.
    AttributeDefinitions: Match.arrayWith([
      { AttributeName: 'minRank', AttributeType: 'N' },
      { AttributeName: 'updatedAt', AttributeType: 'S' },
    ]),
  });
});

test('portal table has TTL on expiresAt and point-in-time recovery', () => {
  const app = new cdk.App();
  const stack = new DataStack(app, 'TestDataStack');
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::DynamoDB::GlobalTable', {
    TimeToLiveSpecification: {
      AttributeName: 'expiresAt',
      Enabled: true,
    },
    // TableV2 applies PITR per-replica via the replica spec.
    Replicas: Match.arrayWith([
      Match.objectLike({
        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: true,
        },
      }),
    ]),
  });
});

test('portal table is retained on stack deletion', () => {
  const app = new cdk.App();
  const stack = new DataStack(app, 'TestDataStack');
  const template = Template.fromStack(stack);

  template.hasResource('AWS::DynamoDB::GlobalTable', {
    DeletionPolicy: 'Retain',
    UpdateReplacePolicy: 'Retain',
  });
});
