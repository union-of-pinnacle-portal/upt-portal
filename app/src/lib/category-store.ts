import "server-only";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "@/lib/aws/dynamo";
import { TABLE_NAME } from "@/lib/aws/config";
import {
  categoryKey,
  normalizeCategoryName,
  MAX_CATEGORY_LENGTH,
} from "@/lib/categories";

/**
 * The category vocabulary — user-extensible, stored in DynamoDB.
 *
 * Categories started as a code constant; they now live in the table so that
 * anyone who may upload a document can add one inline rather than filing a
 * code change. The trade-off is duplicate sprawl ("Minutes" / "minutes" /
 * "meeting minutes"), which `categoryKey` prevents by making a category's
 * identity case- and whitespace-insensitive. First writer wins the display
 * casing; later uses of a differently-cased spelling snap to it.
 *
 * STORAGE (single-table, see infra/README):
 *   Category  pk = `CATEGORIES`  sk = `CAT#<key>`
 *
 * One partition, like rooms, so listing is a single Query with no new GSI. A
 * union accumulates dozens of categories, not millions.
 *
 * There is deliberately no delete: removing a category would leave documents
 * tagged with a name no longer in the picker, and nothing here rewrites
 * documents. Cleanup needs a merge/rename tool that migrates tagged documents
 * too — a separate, Super-User-only job.
 */

/** Partition holding every category item, so `listCategories` is one Query. */
const CATEGORIES_PK = "CATEGORIES";

export interface DocumentCategory {
  /** Canonical display name, e.g. "Meeting Minutes". */
  name: string;
  /** Case-folded identity, the sk suffix. */
  key: string;
  createdBy: string;
  createdAt: string;
}

function categoryDbKey(key: string) {
  return { pk: CATEGORIES_PK, sk: `CAT#${key}` };
}

/** Every category, alphabetically by name. */
export async function listCategories(): Promise<DocumentCategory[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": CATEGORIES_PK },
    }),
  );

  return ((res.Items ?? []) as DocumentCategory[]).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

/** Just the display names — what the picker needs. */
export async function listCategoryNames(): Promise<string[]> {
  return (await listCategories()).map((c) => c.name);
}

/**
 * Create a category unless one with the same key already exists. Returns the
 * canonical display name to use, which is the *existing* name on a collision —
 * so a user typing "minutes" against an existing "Minutes" gets "Minutes".
 */
export async function createCategory(
  name: string,
  createdBy: string,
): Promise<DocumentCategory> {
  const category: DocumentCategory = {
    name,
    key: categoryKey(name),
    createdBy,
    createdAt: new Date().toISOString(),
  };

  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...categoryDbKey(category.key), ...category },
      ConditionExpression: "attribute_not_exists(sk)",
    }),
  );

  return category;
}

export type ResolveCategoriesResult =
  | { ok: true; categories: string[]; created: string[] }
  | { ok: false; error: string };

/**
 * Turn a client-supplied list of category names into canonical names, creating
 * any that do not exist yet.
 *
 * CALL THIS ONLY AFTER THE CALLER'S WRITE PERMISSION HAS BEEN CHECKED. It
 * creates rows as a side effect, so running it during request validation would
 * let anyone who can reach the endpoint pollute the vocabulary with names from
 * a request that goes on to 403.
 *
 * Names are matched case-insensitively against the existing vocabulary and
 * de-duplicated the same way, so ["Legal", "legal"] resolves to one category.
 */
export async function resolveCategories(
  input: unknown,
  createdBy: string,
): Promise<ResolveCategoriesResult> {
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, error: "categories must be a non-empty list." };
  }

  const wanted = new Map<string, string>();
  for (const raw of input) {
    const name = normalizeCategoryName(raw);
    if (!name) {
      return {
        ok: false,
        error: `Each category must be 1–${MAX_CATEGORY_LENGTH} characters.`,
      };
    }
    // First spelling in the request wins among duplicates within it.
    if (!wanted.has(categoryKey(name))) wanted.set(categoryKey(name), name);
  }

  const existing = new Map(
    (await listCategories()).map((c) => [c.key, c.name] as const),
  );

  const categories: string[] = [];
  const created: string[] = [];
  for (const [key, name] of wanted) {
    const known = existing.get(key);
    if (known) {
      categories.push(known);
    } else {
      categories.push(name);
      created.push(name);
    }
  }

  // A concurrent request may have created the same category between the list
  // above and these writes; the condition makes that a no-op rather than an
  // error, and both requests end up tagging the document identically.
  await Promise.all(
    created.map((name) =>
      createCategory(name, createdBy).catch((err: { name?: string }) => {
        if (err?.name !== "ConditionalCheckFailedException") throw err;
      }),
    ),
  );

  return { ok: true, categories, created };
}
