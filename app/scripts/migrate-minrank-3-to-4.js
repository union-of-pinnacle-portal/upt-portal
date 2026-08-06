/**
 * One-time migration: rewrite documents stored with `minRank: 3` to `minRank: 4`.
 *
 *   npm run migrate-minrank            # dry run — reports, changes nothing
 *   npm run migrate-minrank -- --apply # perform the rewrite
 *
 * WHY THIS EXISTS
 * ---------------
 * The portal shipped with three access levels, where rank 3 was the top one
 * (committee heads / Super Users). Adding Committee Chair inserts a new level
 * at rank 3 and pushes Super User to rank 4:
 *
 *   before:  general 1, contributor 2, committee_head 3
 *   after:   general 1, contributor 2, committee_chair 3, committee_head 4
 *
 * A document saved as `minRank: 3` therefore used to mean "Super Users only"
 * but now reads as "Chairs and up". Without this rewrite, every restricted
 * document silently widens to an audience it was never meant for the moment a
 * Chair is appointed. Run this BEFORE assigning anyone the committee_chair role.
 *
 * ORDERING: it is safe to deploy the four-level code first and run this after,
 * because until someone is actually assigned committee_chair nobody holds rank
 * 3 — a minRank-3 document remains visible only to rank-4 Super Users, exactly
 * as before. What is NOT safe is appointing a Chair before this has run.
 *
 * Run via the npm script so AWS credentials/region load from .env.local
 * (node --env-file). Not part of the app build.
 */

const {
  DynamoDBClient,
} = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

const TABLE_NAME = process.env.PORTAL_TABLE_NAME || "upt-portal";
const BY_RANK_INDEX = "by-rank";
const AWS_REGION = process.env.AWS_REGION || "us-east-1";

const OLD_RANK = 3;
const NEW_RANK = 4;

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: AWS_REGION }),
);

/**
 * Collect every document currently at OLD_RANK.
 *
 * Collected in full BEFORE any write: `minRank` is the partition key of the
 * by-rank GSI, so updating an item moves it to a different partition. Mutating
 * while paginating the same partition would make the scan's own results shift
 * under it.
 */
async function collectDocumentsAtOldRank() {
  const items = [];
  let exclusiveStartKey;

  do {
    const res = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: BY_RANK_INDEX,
        KeyConditionExpression: "minRank = :r",
        ExpressionAttributeValues: { ":r": OLD_RANK },
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );

    for (const item of res.Items || []) {
      // Defensive: only Document items carry minRank, but never rewrite
      // anything that isn't one.
      if (typeof item.pk === "string" && item.pk.startsWith("DOC#")) {
        items.push(item);
      } else {
        console.warn(
          `  ! skipping non-document item at minRank ${OLD_RANK}: pk=${item.pk}`,
        );
      }
    }

    exclusiveStartKey = res.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return items;
}

async function main() {
  const apply = process.argv.includes("--apply");

  if (!process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_PROFILE) {
    console.error(
      "No AWS credentials in the environment — run through " +
        "`npm run migrate-minrank` so .env.local is loaded.",
    );
    process.exit(1);
  }

  console.log(
    `${apply ? "APPLYING" : "DRY RUN"} — table "${TABLE_NAME}" in ${AWS_REGION}\n` +
      `Rewriting documents with minRank ${OLD_RANK} → ${NEW_RANK}.\n`,
  );

  const docs = await collectDocumentsAtOldRank();

  if (docs.length === 0) {
    console.log(
      `Nothing to do — no documents at minRank ${OLD_RANK}. ` +
        "(Already migrated, or none were restricted to that level.)",
    );
    process.exit(0);
  }

  console.log(`Found ${docs.length} document(s) at minRank ${OLD_RANK}:`);
  for (const doc of docs) {
    console.log(`  - ${doc.id}  ${JSON.stringify(doc.title)}  [${doc.status}]`);
  }
  console.log("");

  if (!apply) {
    console.log("Dry run — nothing was changed.");
    console.log("Re-run with --apply to perform the rewrite:");
    console.log("  npm run migrate-minrank -- --apply");
    process.exit(0);
  }

  let updated = 0;
  let skipped = 0;

  for (const doc of docs) {
    try {
      await ddb.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { pk: doc.pk, sk: doc.sk },
          UpdateExpression: "SET minRank = :new",
          // Idempotent + safe against a concurrent edit: only rewrite if the
          // item is still at the old rank. Re-running the script is harmless.
          ConditionExpression: "minRank = :old",
          ExpressionAttributeValues: { ":new": NEW_RANK, ":old": OLD_RANK },
        }),
      );
      updated++;
      console.log(`  ✓ ${doc.id}`);
    } catch (err) {
      if (err.name === "ConditionalCheckFailedException") {
        skipped++;
        console.log(`  – ${doc.id} (already changed; left alone)`);
      } else {
        throw err;
      }
    }
  }

  // Deliberately NOT touching `updatedAt`: this is a representation change, not
  // an editorial one, and bumping it would reshuffle every document list.
  console.log(
    `\nDone. ${updated} rewritten, ${skipped} skipped.\n` +
      "Committee Chairs can now be assigned safely.",
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
