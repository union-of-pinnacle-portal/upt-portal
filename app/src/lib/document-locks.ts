import "server-only";
import { DeleteCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "@/lib/aws/dynamo";
import { TABLE_NAME } from "@/lib/aws/config";

/**
 * Advisory edit locks for page documents.
 *
 * THIS IS NOT AUTHORIZATION. Permission to edit is `canWriteInRoom`, checked on
 * every write regardless of any lock. A lock exists only to stop two people
 * unknowingly typing into the same document and one of them losing an hour of
 * work — it is a coordination hint, and the UI treats it as one.
 *
 * Held as a lease rather than a flag, because the common failure is a browser
 * tab closed without warning: a boolean would strand the document forever,
 * while a lease just expires. The editor heartbeats to hold it.
 *
 * STORAGE: pk = `DOC#<id>`, sk = `LOCK`, with `expiresAt` in epoch seconds —
 * the attribute the table's TTL is already configured on, so abandoned locks
 * are reaped by DynamoDB with no cleanup job of ours.
 *
 * TTL deletion is not prompt (DynamoDB gives no timeliness guarantee), so
 * every read compares `expiresAt` itself and treats a stale row as absent.
 * TTL is the janitor, not the clock.
 */

/** How long a lease lasts. The editor refreshes well inside this. */
const LEASE_SECONDS = 120;

export interface DocumentLock {
  heldBy: string;
  /** Epoch seconds. */
  expiresAt: number;
}

function lockKey(id: string) {
  return { pk: `DOC#${id}`, sk: "LOCK" };
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/** The current holder, or null if unheld or expired. */
export async function getLock(id: string): Promise<DocumentLock | null> {
  const res = await ddb.send(
    new GetCommand({ TableName: TABLE_NAME, Key: lockKey(id) }),
  );
  const lock = res.Item as DocumentLock | undefined;
  if (!lock || lock.expiresAt <= nowSeconds()) return null;
  return lock;
}

/**
 * Try to take the lock for `email`.
 *
 * Succeeds if it is unheld, expired, or already theirs — the last case is what
 * makes the editor's heartbeat a plain re-acquire. Returns the winning holder
 * either way, so a caller that loses can name who has it.
 */
export async function acquireLock(
  id: string,
  email: string,
): Promise<{ ok: boolean; lock: DocumentLock }> {
  const lock: DocumentLock = {
    heldBy: email,
    expiresAt: nowSeconds() + LEASE_SECONDS,
  };

  try {
    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: { ...lockKey(id), ...lock },
        ConditionExpression:
          "attribute_not_exists(sk) OR expiresAt <= :now OR heldBy = :me",
        ExpressionAttributeValues: { ":now": nowSeconds(), ":me": email },
      }),
    );
    return { ok: true, lock };
  } catch (err) {
    if ((err as { name?: string }).name !== "ConditionalCheckFailedException") {
      throw err;
    }
    // Someone else holds it. Report who, so the UI can say so by name.
    const held = await getLock(id);
    return held
      ? { ok: false, lock: held }
      : // It expired between the failed write and this read; the next attempt
        // will succeed, so report it as ours-to-take rather than blocking.
        { ok: true, lock };
  }
}

/** Extend an existing lease. A no-op if someone else now holds it. */
export async function refreshLock(id: string, email: string): Promise<void> {
  await acquireLock(id, email);
}

/** Give up the lock, if it is still ours. */
export async function releaseLock(id: string, email: string): Promise<void> {
  await ddb
    .send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: lockKey(id),
        ConditionExpression: "heldBy = :me",
        ExpressionAttributeValues: { ":me": email },
      }),
    )
    .catch((err: { name?: string }) => {
      // Already taken over or already gone — either way there is nothing of
      // ours left to release.
      if (err?.name !== "ConditionalCheckFailedException") throw err;
    });
}
