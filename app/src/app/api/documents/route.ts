import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { isRank, RANKS } from "@/lib/roles";
import { canWriteInRoom, getRoom, writesEverywhere } from "@/lib/rooms";
import { buildStorageKey, createDocument } from "@/lib/documents";
import { resolveCategories } from "@/lib/category-store";
import type { Rank } from "@/lib/roles";

/**
 * POST /api/documents
 *
 * Step 2 of the upload flow: persist the document metadata after the file has
 * been PUT to S3. The client passes back the id and original filename from
 * step 1; the storage key is re-derived server-side (never trusted from the
 * client) so it always matches where the bytes went.
 *
 * This is the enforcement point for room-scoped writes: the caller must belong
 * to the room they are filing into. Super Users may write to any room, and may
 * omit `roomId` to leave a document unfiled — which is also the escape hatch
 * for the very first upload, before any room exists.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const id = str(body.id);
  const title = str(body.title);
  const description = str(body.description);
  const originalFilename = str(body.originalFilename);
  const contentType = str(body.contentType) || "application/octet-stream";
  const roomId = str(body.roomId) || undefined;
  const minRank = body.minRank;
  const status = body.status;
  const sizeBytes = typeof body.sizeBytes === "number" ? body.sizeBytes : NaN;

  const errors: string[] = [];
  if (!id) errors.push("id is required.");
  if (!title) errors.push("title is required.");
  if (!originalFilename) errors.push("originalFilename is required.");
  if (!isRank(minRank)) {
    errors.push(`minRank must be one of ${RANKS.join(", ")}.`);
  }
  if (status !== "draft" && status !== "published") {
    errors.push("status must be draft or published.");
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
    errors.push("sizeBytes must be a non-negative number.");
  }

  // Only Super Users may leave a document unfiled; everyone else must name a
  // room, because a room is the only thing that can authorize their write.
  if (!roomId && !writesEverywhere(user.role)) {
    errors.push("roomId is required.");
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  }

  // Reject unknown rooms before the membership check, so filing into a
  // nonexistent room is a clear 400 rather than a confusing 403.
  if (roomId && !(await getRoom(roomId))) {
    return NextResponse.json({ error: "Unknown room." }, { status: 400 });
  }

  if (!(await canWriteInRoom(user, roomId))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  // Only now, past the permission check — resolving may create new categories,
  // and a request that goes on to 403 must not leave any behind.
  const resolved = await resolveCategories(body.categories, user.email);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }

  const doc = await createDocument({
    id,
    title,
    description: description || undefined,
    categories: resolved.categories,
    roomId,
    minRank: minRank as Rank,
    status: status as "draft" | "published",
    storageKey: buildStorageKey(id, originalFilename),
    originalFilename,
    contentType,
    sizeBytes,
    uploadedBy: user.email,
  });

  return NextResponse.json({ id: doc.id }, { status: 201 });
}
