import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canViewRank } from "@/lib/roles";
import { canWriteInRoom } from "@/lib/rooms";
import {
  addDocumentVersion,
  buildVersionStorageKey,
  getDocument,
  listVersions,
  versionHistory,
} from "@/lib/documents";

/**
 * GET /api/documents/:id/versions
 *
 * The file history for a document. Gated by the same rules as downloading it:
 * rank must clear `minRank`, and unpublished documents are visible only to
 * whoever may write the room. A history listing leaks filenames and who
 * uploaded them, so it must never be looser than the file itself.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await params;
  const doc = await getDocument(id);
  if (!doc) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const canManage = await canWriteInRoom(user, doc.roomId);
  if (!canManage && doc.status !== "published") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (!canViewRank(user.role, doc.minRank)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const versions = versionHistory(doc, await listVersions(id));

  // storageKey is deliberately not returned — it is an internal S3 path, and
  // downloads go through the download route so access is re-checked each time.
  return NextResponse.json({
    versions: versions.map((v) => ({
      version: v.version,
      originalFilename: v.originalFilename,
      sizeBytes: v.sizeBytes,
      uploadedBy: v.uploadedBy,
      uploadedAt: v.uploadedAt,
    })),
  });
}

/**
 * POST /api/documents/:id/versions
 *
 * Step 2 of replacing a document's file: record the version whose bytes were
 * just PUT to S3, and point the document at it. The storage key is re-derived
 * server-side from the id, version and filename — never taken from the client
 * — so a caller cannot attach an arbitrary existing object to a document.
 *
 * Replacing a file is as privileged as editing the document, so it takes the
 * same room-scoped write check.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await params;
  const doc = await getDocument(id);
  if (!doc) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (!(await canWriteInRoom(user, doc.roomId))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const version = typeof body.version === "number" ? body.version : NaN;
  const originalFilename =
    typeof body.originalFilename === "string" ? body.originalFilename.trim() : "";
  const contentType =
    typeof body.contentType === "string" && body.contentType
      ? body.contentType
      : "application/octet-stream";
  const sizeBytes = typeof body.sizeBytes === "number" ? body.sizeBytes : NaN;

  const errors: string[] = [];
  // Version 1 is the original upload and is never claimed by a replacement.
  if (!Number.isInteger(version) || version < 2) {
    errors.push("version must be an integer of 2 or more.");
  }
  if (!originalFilename) errors.push("originalFilename is required.");
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
    errors.push("sizeBytes must be a non-negative number.");
  }
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  }

  const created = await addDocumentVersion({
    document: doc,
    version,
    storageKey: buildVersionStorageKey(id, version, originalFilename),
    originalFilename,
    contentType,
    sizeBytes,
    uploadedBy: user.email,
  });

  if (!created) {
    return NextResponse.json(
      {
        error:
          "That version already exists — someone else replaced this file first. Reload and try again.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ version: created.version }, { status: 201 });
}
