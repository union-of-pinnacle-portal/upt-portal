import * as cdk from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';
import { AccessStack } from '../lib/access-stack';

test('creates exactly one app IAM user with a stable name', () => {
  const app = new cdk.App();
  const stack = new AccessStack(app, 'TestAccessStack');
  const template = Template.fromStack(stack);

  template.resourceCountIs('AWS::IAM::User', 1);
  template.hasResourceProperties('AWS::IAM::User', {
    UserName: 'upt-portal-app',
  });
});

test('grants the app read/write on the DynamoDB table and its indexes', () => {
  const app = new cdk.App();
  const stack = new AccessStack(app, 'TestAccessStack');
  const template = Template.fromStack(stack);
  // String-match to stay independent of action ordering (Match.arrayWith is
  // order-preserving, and the grant helper's action order is not contractual).
  const dump = JSON.stringify(template.findResources('AWS::IAM::Policy'));

  expect(dump).toContain('dynamodb:GetItem');
  expect(dump).toContain('dynamodb:PutItem');
  expect(dump).toContain('dynamodb:Query');
  // grantIndexPermissions extends the resource to the table's GSIs.
  expect(dump).toContain('/index/*');
});

test('grants the app get/put on document objects but not delete', () => {
  const app = new cdk.App();
  const stack = new AccessStack(app, 'TestAccessStack');
  const template = Template.fromStack(stack);
  const policies = template.findResources('AWS::IAM::Policy');

  const actions = JSON.stringify(policies);
  expect(actions).toContain('s3:GetObject');
  expect(actions).toContain('s3:PutObject');
  expect(actions).not.toContain('s3:DeleteObject');
});

test('does not create an access key (no secret in CloudFormation)', () => {
  const app = new cdk.App();
  const stack = new AccessStack(app, 'TestAccessStack');
  const template = Template.fromStack(stack);

  template.resourceCountIs('AWS::IAM::AccessKey', 0);
});
