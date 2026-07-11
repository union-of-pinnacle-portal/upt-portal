#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { StorageStack } from '../lib/storage-stack';
import { DataStack } from '../lib/data-stack';
import { AccessStack } from '../lib/access-stack';

const app = new cdk.App();

// Resolve the target account/region from the local AWS profile/CLI config.
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

new StorageStack(app, 'UptPortalStorageStack', { env });
new DataStack(app, 'UptPortalDataStack', { env });
// References the table and bucket by name, so deploy it after those exist.
new AccessStack(app, 'UptPortalAccessStack', { env });
