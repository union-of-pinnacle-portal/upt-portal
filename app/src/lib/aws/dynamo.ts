import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { AWS_REGION } from "./config";

/**
 * Shared DynamoDB Document client.
 *
 * The Document client marshals plain JS objects to/from DynamoDB attribute
 * values, so callers work with ordinary objects. A single instance is reused
 * across invocations (module-level singleton) to keep connections warm.
 *
 * `removeUndefinedValues` lets callers pass sparse items (e.g. an optional
 * `description`) without hand-pruning undefined keys.
 */
const client = new DynamoDBClient({ region: AWS_REGION });

export const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});
