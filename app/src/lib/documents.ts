import "server-only";
import {
  BatchWriteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddb } from "@/lib/aws/dynamo";
import { getObjectText, putObjectText } from "@/lib/aws/s3";
import type { DocumentKind } from "@/lib/document-formats";
import { BY_RANK_INDEX, TABLE_NAME } from "@/lib/aws/config";
import { RANKS, type Rank } from "@/lib/roles";

export type DocumentStatus = "draft" | "published" | "archived";

// Kind lives in lib/document-formats.ts, which is a plain module: the client
// documents table needs it, and this one is server-only. Re-exported so server
// callers can keep importing it from here alongside everything else.
export { documentKind, type DocumentKind } from "@/lib/document-formats";

/** The storage key holding a page document's editor content. */
export const PAGE_CONTENT_FILENAME = "content.json";

/**
 * A serialized empty Lexical editor state — one blank paragraph.
 *
 * Written when a page document is created so its content object always exists
 * and always parses.
 */
export const EMPTY_PAGE_CONTENT = JSON.stringify({
  root: {
    children: [
      {
        children: [],
        direction: null,
        format: "",
        indent: 0,
        type: "paragraph",
        version: 1,
      },
    ],
    direction: null,
    format: "",
    indent: 0,
    type: "root",
    version: 1,
  },
});

/**
 * A document as stored under `pk = sk = DOC#<id>` (see infra data model).
 * `minRank` is the lowest rank allowed to view it and is the partition key of
 * the `by-rank` GSI that serves the role-based list.
 *
 * `roomId` is the Committee Room the document belongs to. It scopes WRITES
 * only — who may edit or replace it — never reads, which stay global and
 * rank-based. It is optional because documents uploaded before Committee Rooms
 * existed have no room; those are "unfiled" and writable only by Super Users
 * (see lib/rooms.ts `canWriteInRoom`).
 */
export interface PortalDocument {
  id: string;
  title: string;
  description?: string;
  /** Absent means "file" — see `documentKind`. */
  kind?: DocumentKind;
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
 * A past or present revision of a document's file.
 *
 * Stored under `pk = DOC#<id>`, `sk = VER#<zero-padded number>` — the same
 * partition as the document, so history is one Query. The number is padded
 * because DynamoDB sorts sort keys lexicographically, and "VER#10" must come
 * after "VER#9".
 *
 * The document item itself always mirrors the NEWEST version's file fields, so
 * every existing read path keeps working without knowing versions exist.
 */
export interface DocumentVersion {
  documentId: string;
  version: number;
  storageKey: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string;
  uploadedAt: string;
}

/** Width of the zero-padded version number in the sort key. */
const VERSION_PAD = 6;

function versionKey(id: string, version: number) {
  return {
    pk: `DOC#${id}`,
    sk: `VER#${String(version).padStart(VERSION_PAD, "0")}`,
  };
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
 * The S3 object key for a replacement file (version 2 and up).
 *
 * Each version gets its OWN object rather than overwriting the original key,
 * so history is a property of our own data model rather than of S3 object
 * versioning, and a replacement may carry a different filename. Version 1
 * keeps `buildStorageKey`'s unversioned path, so pre-existing documents need
 * no object moved.
 */
export function buildVersionStorageKey(
  id: string,
  version: number,
  filename: string,
): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
  return `documents/${id}/v${version}/${safe}`;
}

export interface CreateDocumentInput {
  id: string;
  title: string;
  description?: string;
  kind?: DocumentKind;
  categories: string[];
  roomId?: string;
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

/* ------------------------------------------------------------------ *
 * File versions
 * ------------------------------------------------------------------ */

/** Stored version items for a document, newest first. */
export async function listVersions(id: string): Promise<DocumentVersion[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: { ":pk": `DOC#${id}`, ":prefix": "VER#" },
      ScanIndexForward: false,
    }),
  );
  return (res.Items ?? []) as DocumentVersion[];
}

/** Version 1 as described by the document item itself. */
function originalVersion(doc: PortalDocument): DocumentVersion {
  return {
    documentId: doc.id,
    version: 1,
    storageKey: doc.storageKey,
    originalFilename: doc.originalFilename,
    contentType: doc.contentType,
    sizeBytes: doc.sizeBytes,
    uploadedBy: doc.uploadedBy,
    uploadedAt: doc.createdAt,
  };
}

/**
 * The version history to show for a document.
 *
 * A document that has never been replaced has no version items at all — its
 * only file is the one the document item describes. Rather than backfilling
 * every existing row, that original is synthesized as version 1 here, and
 * persisted for real the first time someone replaces the file.
 */
export function versionHistory(
  doc: PortalDocument,
  stored: DocumentVersion[],
): DocumentVersion[] {
  if (stored.length > 0) return stored;
  return [originalVersion(doc)];
}

/** The number a replacement should take. Always >= 2; 1 is the original. */
export async function nextVersionNumber(id: string): Promise<number> {
  const stored = await listVersions(id);
  return stored.length === 0 ? 2 : stored[0].version + 1;
}

export interface AddVersionInput {
  document: PortalDocument;
  version: number;
  storageKey: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string;
  /**
   * Flip the document's kind as part of the same write. Only conversion uses
   * this, and it must be atomic with the repoint: a document whose `kind` and
   * `storageKey` disagree is broken both ways — a "file" pointing at editor
   * JSON downloads gibberish, a "page" pointing at a .docx will not open.
   */
  setKind?: DocumentKind;
}

/**
 * Record a replacement file as a new version and point the document at it.
 *
 * Ordered so a failure part-way never loses the file anyone is downloading:
 * backfill version 1 first (otherwise the repoint destroys the only record of
 * where the original bytes live), then claim the new number conditionally so
 * two concurrent replacements cannot both take it, then repoint.
 */
export async function addDocumentVersion(
  input: AddVersionInput,
): Promise<DocumentVersion | null> {
  const { document: doc } = input;

  const stored = await listVersions(doc.id);
  if (stored.length === 0) {
    await ddb
      .send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: { ...versionKey(doc.id, 1), ...originalVersion(doc) },
          ConditionExpression: "attribute_not_exists(sk)",
        }),
      )
      .catch((err: { name?: string }) => {
        // A concurrent replacement may have just backfilled it; the content is
        // identical either way, so losing this race is a no-op.
        if (err?.name !== "ConditionalCheckFailedException") throw err;
      });
  }

  const version: DocumentVersion = {
    documentId: doc.id,
    version: input.version,
    storageKey: input.storageKey,
    originalFilename: input.originalFilename,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    uploadedBy: input.uploadedBy,
    uploadedAt: new Date().toISOString(),
  };

  try {
    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: { ...versionKey(doc.id, input.version), ...version },
        ConditionExpression: "attribute_not_exists(sk)",
      }),
    );
  } catch (err) {
    if ((err as { name?: string }).name === "ConditionalCheckFailedException") {
      return null;
    }
    throw err;
  }

  const values: Record<string, unknown> = {
    ":k": version.storageKey,
    ":f": version.originalFilename,
    ":c": version.contentType,
    ":s": version.sizeBytes,
    ":u": version.uploadedAt,
  };
  let expression =
    "SET storageKey = :k, originalFilename = :f, contentType = :c, " +
    "sizeBytes = :s, updatedAt = :u";
  if (input.setKind) {
    expression += ", kind = :kind";
    values[":kind"] = input.setKind;
  }

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: docKey(doc.id),
      UpdateExpression: expression,
      ConditionExpression: "attribute_exists(pk)",
      ExpressionAttributeValues: values,
    }),
  );

  return version;
}

/** A specific version, or null. Version 1 may be synthesized. */
export async function getVersion(
  doc: PortalDocument,
  version: number,
): Promise<DocumentVersion | null> {
  const stored = await listVersions(doc.id);
  return versionHistory(doc, stored).find((v) => v.version === version) ?? null;
}

/* ------------------------------------------------------------------ *
 * Page content
 * ------------------------------------------------------------------ */

/**
 * The editor content of a page document, or null if it has none yet.
 *
 * Content lives in S3 rather than on the document item because
 * `listVisibleForUser` returns whole items: a body stored there would make
 * every dashboard load fetch the full text of every visible document. S3 also
 * removes DynamoDB's 400 KB item ceiling.
 */
export function readPageContent(doc: PortalDocument): Promise<string | null> {
  return getObjectText(doc.storageKey);
}

/**
 * Save new editor content as the next version of a page document.
 *
 * Each save is a version, exactly like replacing an uploaded file, so page
 * documents get history for free. Returns null if the version was claimed
 * concurrently, which the caller surfaces as a conflict rather than silently
 * clobbering someone's work.
 */
export async function savePageContent(
  doc: PortalDocument,
  content: string,
  savedBy: string,
  /** Set when this save is also a file→page conversion. */
  setKind?: DocumentKind,
): Promise<DocumentVersion | null> {
  const version = await nextVersionNumber(doc.id);
  const storageKey = buildVersionStorageKey(
    doc.id,
    version,
    PAGE_CONTENT_FILENAME,
  );
  const sizeBytes = await putObjectText(storageKey, content);

  return addDocumentVersion({
    document: doc,
    version,
    storageKey,
    originalFilename: PAGE_CONTENT_FILENAME,
    contentType: "application/json",
    sizeBytes,
    uploadedBy: savedBy,
    setKind,
  });
}

/**
 * Permanently delete a document and everything filed under it.
 *
 * A document's whole life lives in one partition — the document item, every
 * `VER#` revision, the `LOCK`, and any `LOG#` download records — so erasing it
 * is a query of that partition followed by a batched delete. That is also why
 * nothing here needs to know which item types exist.
 *
 * THE S3 OBJECTS ARE LEFT BEHIND. The app's IAM user is granted read and put
 * on the bucket, not delete (see infra/lib/access-stack.ts), so it cannot
 * remove the bytes even if it wanted to. Once the DynamoDB records are gone
 * nothing references those keys and they are unreachable through the portal —
 * the bucket blocks public access and the app only ever signs URLs for keys it
 * read from a document record. They are orphaned, not exposed. Removing them
 * for real needs `bucket.grantDelete(appUser)` in the CDK and a redeploy.
 *
 * This is irreversible from inside the app. Archiving is the reversible
 * alternative and should be the default for anything that is a real record.
 */
export async function deleteDocument(id: string): Promise<number> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": `DOC#${id}` },
      ProjectionExpression: "pk, sk",
    }),
  );

  const items = res.Items ?? [];
  if (items.length === 0) return 0;

  // BatchWrite takes 25 at a time.
  for (let i = 0; i < items.length; i += 25) {
    const chunk = items.slice(i, i + 25);
    await ddb.send(
      new BatchWriteCommand({
        RequestItems: {
          [TABLE_NAME]: chunk.map((item) => ({
            DeleteRequest: { Key: { pk: item.pk, sk: item.sk } },
          })),
        },
      }),
    );
  }

  return items.length;
}
