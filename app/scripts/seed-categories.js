/**
 * Seed the category vocabulary.
 *
 *   npm run seed-categories            # dry run — reports, changes nothing
 *   npm run seed-categories -- --apply # write the missing categories
 *
 * WHY THIS EXISTS
 * ---------------
 * Categories live in DynamoDB (pk = `CATEGORIES`, sk = `CAT#<key>`) so that
 * anyone who may upload can create one from the picker. A fresh deployment
 * therefore starts with an empty list, which makes the picker look broken. This
 * seeds a starting set.
 *
 * It also registers the free-text categories on documents that predate the
 * multi-category change, so those names appear in the picker as real options
 * instead of vanishing the first time someone edits an old document.
 *
 * Safe to re-run: every write is conditional on the category not existing, and
 * matching is case-insensitive, so an existing "Legal" is never duplicated by
 * "legal".
 *
 * Run via the npm script so AWS credentials/region load from .env.local
 * (node --env-file). Not part of the app build.
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");

const TABLE_NAME = process.env.PORTAL_TABLE_NAME || "upt-portal";
const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const CATEGORIES_PK = "CATEGORIES";

// The starting vocabulary. This is the only definition: the app reads
// categories from DynamoDB, never from a constant, so editing this list only
// affects what a fresh `--apply` would add.
const DEFAULT_CATEGORIES = [
  "Meeting Minutes",
  "Agendas",
  "Bylaws & Governance",
  "Financials",
  "Campaigns & Actions",
  "Tenant Resources",
  "Legal",
  "Outreach & Media",
  "Onboarding & Training",
  "Reports & Research",
  "Forms & Templates",
  "Other",
];

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: AWS_REGION }),
);

/** Mirrors normalizeCategoryName/categoryKey in src/lib/categories.ts. */
function normalize(raw) {
  if (typeof raw !== "string") return null;
  const name = raw.trim().replace(/\s+/g, " ");
  return name && name.length <= 60 ? name : null;
}

async function existingKeys() {
  const keys = new Set();
  let exclusiveStartKey;
  do {
    const res = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": CATEGORIES_PK },
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );
    for (const item of res.Items || []) keys.add(item.key);
    exclusiveStartKey = res.LastEvaluatedKey;
  } while (exclusiveStartKey);
  return keys;
}

/**
 * Category names already in use on documents — both the legacy single
 * `category` string and any `categories` list, in case a document was written
 * before this script first ran.
 */
async function namesUsedByDocuments() {
  const names = [];
  let exclusiveStartKey;
  do {
    const res = await ddb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "begins_with(pk, :doc)",
        ProjectionExpression: "category, categories",
        ExpressionAttributeValues: { ":doc": "DOC#" },
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );
    for (const item of res.Items || []) {
      if (item.category) names.push(item.category);
      for (const c of item.categories || []) names.push(c);
    }
    exclusiveStartKey = res.LastEvaluatedKey;
  } while (exclusiveStartKey);
  return names;
}

async function main() {
  const apply = process.argv.includes("--apply");

  if (!process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_PROFILE) {
    console.error(
      "No AWS credentials in the environment — run through " +
        "`npm run seed-categories` so .env.local is loaded.",
    );
    process.exit(1);
  }

  console.log(
    `${apply ? "APPLYING" : "DRY RUN"} — table "${TABLE_NAME}" in ${AWS_REGION}\n`,
  );

  const known = await existingKeys();
  const fromDocuments = await namesUsedByDocuments();

  // Defaults first so they win the display casing over a legacy free-text
  // spelling of the same thing ("Legal" beats "legal").
  const missing = new Map();
  for (const raw of [...DEFAULT_CATEGORIES, ...fromDocuments]) {
    const name = normalize(raw);
    if (!name) continue;
    const key = name.toLowerCase();
    if (known.has(key) || missing.has(key)) continue;
    missing.set(key, name);
  }

  if (missing.size === 0) {
    console.log(
      `Nothing to do — all ${known.size} categories already exist.`,
    );
    process.exit(0);
  }

  console.log(`${known.size} categor(ies) already exist. Adding ${missing.size}:`);
  for (const name of missing.values()) console.log(`  - ${name}`);
  console.log("");

  if (!apply) {
    console.log("Dry run — nothing was changed.");
    console.log("Re-run with --apply to write them:");
    console.log("  npm run seed-categories -- --apply");
    process.exit(0);
  }

  let created = 0;
  let skipped = 0;
  const createdAt = new Date().toISOString();

  for (const [key, name] of missing) {
    try {
      await ddb.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            pk: CATEGORIES_PK,
            sk: `CAT#${key}`,
            name,
            key,
            createdBy: "seed-script",
            createdAt,
          },
          ConditionExpression: "attribute_not_exists(sk)",
        }),
      );
      created++;
      console.log(`  ✓ ${name}`);
    } catch (err) {
      if (err.name === "ConditionalCheckFailedException") {
        skipped++;
        console.log(`  – ${name} (created concurrently; left alone)`);
      } else {
        throw err;
      }
    }
  }

  console.log(`\nDone. ${created} created, ${skipped} skipped.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
