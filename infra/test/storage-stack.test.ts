import * as cdk from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';
import { StorageStack } from '../lib/storage-stack';

test('documents bucket blocks all public access', () => {
  const app = new cdk.App();
  const stack = new StorageStack(app, 'TestStorageStack');
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::S3::Bucket', {
    BucketName: 'upt-portal-documents',
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true,
    },
  });
});

test('documents bucket has S3-managed encryption and versioning', () => {
  const app = new cdk.App();
  const stack = new StorageStack(app, 'TestStorageStack');
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::S3::Bucket', {
    BucketEncryption: {
      ServerSideEncryptionConfiguration: [
        {
          ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' },
        },
      ],
    },
    VersioningConfiguration: { Status: 'Enabled' },
  });
});

test('documents bucket is retained on stack deletion', () => {
  const app = new cdk.App();
  const stack = new StorageStack(app, 'TestStorageStack');
  const template = Template.fromStack(stack);

  template.hasResource('AWS::S3::Bucket', {
    DeletionPolicy: 'Retain',
    UpdateReplacePolicy: 'Retain',
  });
});

test('exactly one bucket is created', () => {
  const app = new cdk.App();
  const stack = new StorageStack(app, 'TestStorageStack');
  const template = Template.fromStack(stack);

  template.resourceCountIs('AWS::S3::Bucket', 1);
});
