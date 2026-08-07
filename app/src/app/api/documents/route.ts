import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { isRank, RANKS } from "@/lib/roles";
import { canWriteInRoom, getRoom, writesEverywhere } from "@/lib/rooms";
import {
  buildStorageKey,
  createDocument,
} from "@/lib/documents";
import { buildContentKey, type DocumentKind } from "@/lib/document-formats";
import { resolveCategories } from "@/lib/category-store";
import type { Rank } from "@/lib/roles";

/**
 * POST /api/documents
 *
 * Creates a document of either kind:
 *
 *   kind: "file" (default) — standard upload flow. Client passes id +
 *     originalFilename after the file has been PUT to S3. storageKey is
 *     re-derived server-side.
 *
 *   kind: "page" — portal-authored document. No file upload step. storageKey
 *     points to the content JSON location; sizeBytes may be 0.
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
  const kind: DocumentKind =
    body.kind === "page" ? "page" : "file";

  const errors: string[] = [];
  if (!id) errors.push("id is required.");
  if (!title) errors.push("title is required.");
  if (kind === "file" && !originalFilename)
    errors.push("originalFilename is required.");
  if (!isRank(minRank)) {
    errors.push(`minRank must be one of ${RANKS.join(", ")}.`);
  }
  if (status !== "draft" && status !== "published") {
    errors.push("status must be draft or published.");
  }
  if (kind === "file" && (!Number.isFinite(sizeBytes) || sizeBytes < 0)) {
    errors.push("sizeBytes must be a non-negative number.");
  }

  if (!roomId && !writesEverywhere(user.role)) {
    errors.push("roomId is required.");
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  }

  if (roomId && !(await getRoom(roomId))) {
    return NextResponse.json({ error: "Unknown room." }, { status: 400 });
  }

  if (!(await canWriteInRoom(user, roomId))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const resolved = await resolveCategories(body.categories, user.email);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }

  // For page documents, storageKey points to the content JSON location.
  // For file documents, it's derived from the filename as before.
  const storageKey =
    kind === "page"
      ? buildContentKey(id)
      : buildStorageKey(id, originalFilename);

  const doc = await createDocument({
    id,
    title,
    description: description || undefined,
    categories: resolved.categories,
    roomId,
    minRank: minRank as Rank,
    status: status as "draft" | "published",
    kind,
    storageKey,
    originalFilename: kind === "page" ? `${id}.page` : originalFilename,
    contentType: kind === "page" ? "application/json" : contentType,
    sizeBytes: kind === "page" ? 0 : sizeBytes,
    uploadedBy: user.email,
  });

  return NextResponse.json({ id: doc.id }, { status: 201 });
}

