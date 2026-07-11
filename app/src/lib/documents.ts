import "server-only";
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddb } from "@/lib/aws/dynamo";
import { BY_RANK_INDEX, TABLE_NAME } from "@/lib/aws/config";
import type { Rank } from "@/lib/roles";

export type DocumentStatus = "draft" | "published" | "archived";

/**
 * A document as stored under `pk = sk = DOC#<id>` (see infra data model).
 * `minRank` is the lowest rank allowed to view it and is the partition key of
 * the `by-rank` GSI that serves the role-based list.
 */
export interface PortalDocument {
  id: string;
  title: string;
  description?: string;
  category: string;
  minRank: Rank;
  status: DocumentStatus;
  storageKey: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

/** DynamoDB primary key for a document id. */
function docKey(id: string) {
  return { pk: `DOC#${id}`, sk: `DOC#${id}` };
}

/**
 * The S3 object key for a document, derived deterministically from its id and
 * original filename. The upload-url and create routes both call this, so the
 * server — never the client — decides where bytes live; a client cannot point
 * a document's metadata at an arbitrary existing object.
 */
export function buildStorageKey(id: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
  return `documents/${id}/${safe}`;
}

export interface CreateDocumentInput {
  id: string;
  title: string;
  description?: string;
  category: string;
  minRank: Rank;
  status: Exclude<DocumentStatus, "archived">;
  storageKey: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string;
}

/**
 * Write a new document item. `createdAt`/`updatedAt` are stamped server-side.
 * The condition guards against clobbering an existing id (uuid collisions or a
 * duplicate submit).
 */
export async function createDocument(
  input: CreateDocumentInput,
): Promise<PortalDocument> {
  const now = new Date().toISOString();
  const doc: PortalDocument = { ...input, createdAt: now, updatedAt: now };

  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...docKey(input.id), ...doc },
      ConditionExpression: "attribute_not_exists(pk)",
    }),
  );

  return doc;
}

/**
 * List every PUBLISHED document a member of the given rank may view, newest
 * first. A rank sees all documents whose `minRank` is at or below its own, so
 * we query each eligible `minRank` partition of the `by-rank` GSI (at most
 * three) and merge-sort by `updatedAt`. Fine for P0's low document volume.
 *
 * Draft and archived documents are excluded — regular members never see them.
 */
export async function listPublishedForRank(
  rank: Rank,
): Promise<PortalDocument[]> {
  const visibleRanks = [1, 2, 3].filter((r) => r <= rank);

  const perRank = await Promise.all(
    visibleRanks.map((r) =>
      ddb.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: BY_RANK_INDEX,
          KeyConditionExpression: "minRank = :r",
          // `status` is a DynamoDB reserved word — alias it.
          FilterExpression: "#status = :published",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: { ":r": r, ":published": "published" },
          ScanIndexForward: false,
        }),
      ),
    ),
  );

  return perRank
    .flatMap((res) => (res.Items ?? []) as PortalDocument[])
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * List every document for admin management, newest first, regardless of status
 * (includes drafts and archived). Same GSI query as the member list but without
 * the published filter. Committee-head only — callers must gate access.
 */
export async function listAllForAdmin(): Promise<PortalDocument[]> {
  const perRank = await Promise.all(
    [1, 2, 3].map((r) =>
      ddb.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: BY_RANK_INDEX,
          KeyConditionExpression: "minRank = :r",
          ExpressionAttributeValues: { ":r": r },
          ScanIndexForward: false,
        }),
      ),
    ),
  );

  return perRank
    .flatMap((res) => (res.Items ?? []) as PortalDocument[])
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** The document fields an admin may edit after upload. */
export interface UpdateDocumentInput {
  title?: string;
  description?: string;
  category?: string;
  minRank?: Rank;
  status?: DocumentStatus;
}

/**
 * Apply a partial metadata update to a document and bump `updatedAt`. Only the
 * provided fields change. An empty-string `description` clears the attribute.
 * Returns the updated document, or null if no document with that id exists.
 */
export async function updateDocument(
  id: string,
  patch: UpdateDocumentInput,
): Promise<PortalDocument | null> {
  const names: Record<string, string> = { "#updatedAt": "updatedAt" };
  const values: Record<string, unknown> = {
    ":updatedAt": new Date().toISOString(),
  };
  const sets: string[] = ["#updatedAt = :updatedAt"];
  const removes: string[] = [];

  const set = (attr: string, val: unknown) => {
    names[`#${attr}`] = attr;
    values[`:${attr}`] = val;
    sets.push(`#${attr} = :${attr}`);
  };

  if (patch.title !== undefined) set("title", patch.title);
  if (patch.category !== undefined) set("category", patch.category);
  if (patch.minRank !== undefined) set("minRank", patch.minRank);
  if (patch.status !== undefined) set("status", patch.status);
  if (patch.description !== undefined) {
    if (patch.description === "") {
      names["#description"] = "description";
      removes.push("#description");
    } else {
      set("description", patch.description);
    }
  }

  let expression = `SET ${sets.join(", ")}`;
  if (removes.length > 0) expression += ` REMOVE ${removes.join(", ")}`;

  try {
    const res = await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: docKey(id),
        UpdateExpression: expression,
        // Fail rather than resurrect a deleted/nonexistent document.
        ConditionExpression: "attribute_exists(pk)",
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: "ALL_NEW",
      }),
    );
    return (res.Attributes as PortalDocument | undefined) ?? null;
  } catch (err) {
    if ((err as { name?: string }).name === "ConditionalCheckFailedException") {
      return null;
    }
    throw err;
  }
}

/** Fetch a single document by id, or null if it does not exist. */
export async function getDocument(id: string): Promise<PortalDocument | null> {
  const res = await ddb.send(
    new GetCommand({ TableName: TABLE_NAME, Key: docKey(id) }),
  );
  return (res.Item as PortalDocument | undefined) ?? null;
}
