import "server-only";
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddb } from "@/lib/aws/dynamo";
import { BY_RANK_INDEX, TABLE_NAME } from "@/lib/aws/config";
import { RANKS, type Rank } from "@/lib/roles";

export type DocumentStatus = "draft" | "published" | "archived";

/**
 * A document is one of two kinds:
 *  "file" — an uploaded binary (PDF, DOCX, etc.). Body in S3, served via
 *            presigned download URL. Default for all existing documents.
 *  "page" — authored in the portal with the Lexical editor. Body in S3 as
 *            JSON, served via the content API. Never triggers a file download.
 *
 * `kind` is absent on documents created before this feature; treat those as
 * "file" via the `documentKind()` helper — no migration needed.
 */
export type DocumentKind = "file" | "page";

/** Safe accessor — absent means "file" (backwards compat). */
export function documentKind(doc: PortalDocument): DocumentKind {
  return doc.kind ?? "file";
}

export interface PortalDocument {
  id: string;
  title: string;
  description?: string;
  /**
   * One or more categories, resolved through lib/category-store.ts so the
   * names stored here always match an existing category. Optional only because
   * documents written before multi-category support carry a single free-text
   * `category` instead; read them through `documentCategories()` rather than
   * touching either field directly.
   */
  categories?: string[];
  /** @deprecated Legacy single free-text category. Read-only; never written. */
  category?: string;
  roomId?: string;
  minRank: Rank;
  status: DocumentStatus;
  /** "file" | "page". Absent on legacy docs — use documentKind(). */
  kind?: DocumentKind;
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

/**
 * S3 key for the Lexical JSON content of a page document.
 * Separate from the file storageKey so file and page bodies never collide.
 */
export function buildContentKey(id: string): string {
  return `pages/${id}/content.json`;
}

export interface CreateDocumentInput {
  id: string;
  title: string;
  description?: string;
  categories: string[];
  roomId?: string;
  minRank: Rank;
  status: Exclude<DocumentStatus, "archived">;
  kind?: DocumentKind;
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
 * List the documents a user may see on the dashboard, newest first.
 *
 * Two independent dimensions decide this, and conflating them is the easy way
 * to build a leak:
 *
 *   RANK  (global) — a user sees documents whose `minRank` is at or below their
 *         own, and never above it. Enforced by which `by-rank` GSI partitions
 *         we query at all, so an out-of-rank document is never even fetched.
 *         This bound applies to EVERYONE, including someone who manages the
 *         room a document sits in: rooms scope writes, not reads.
 *
 *   STATUS (per room) — drafts and archived documents are hidden from ordinary
 *         members, but visible to whoever manages the room holding them, since
 *         those are the people expected to act on them.
 *
 * We query one partition per eligible rank and merge-sort by `updatedAt`. Fine
 * for P0's low document volume.
 */
export async function listVisibleForUser(opts: {
  rank: Rank;
  /** Rooms the user may write in — their unpublished documents are shown. */
  manageableRoomIds: ReadonlySet<string>;
  /** Super Users: every document at their rank, including unfiled ones. */
  managesEverything: boolean;
}): Promise<PortalDocument[]> {
  const visibleRanks = RANKS.filter((r) => r <= opts.rank);

  const perRank = await Promise.all(
    visibleRanks.map((r) =>
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
    .filter(
      (doc) =>
        doc.status === "published" ||
        opts.managesEverything ||
        (doc.roomId !== undefined && opts.manageableRoomIds.has(doc.roomId)),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * The document fields an admin may edit after upload.
 *
 * `roomId` is deliberately absent: moving a document between rooms changes who
 * may write it, so it is a permission change rather than a metadata edit. A
 * Chair could otherwise walk a document into a room they control and take
 * ownership of it. Leave re-filing to a dedicated, Super-User-only action.
 */
export interface UpdateDocumentInput {
  title?: string;
  description?: string;
  categories?: string[];
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
  if (patch.categories !== undefined) {
    set("categories", patch.categories);
    // Drop the legacy single-category attribute so a document never carries
    // both — `documentCategories()` prefers the array, but leaving a stale
    // value behind invites the two drifting apart.
    names["#category"] = "category";
    removes.push("#category");
  }
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
