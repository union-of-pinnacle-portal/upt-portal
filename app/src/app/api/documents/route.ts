import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canManageDocuments } from "@/lib/roles";
import { buildStorageKey, createDocument } from "@/lib/documents";
import type { Rank } from "@/lib/roles";

/**
 * POST /api/documents
 *
 * Step 2 of the admin upload flow: persist the document metadata after the
 * file has been PUT to S3. Committee heads only. The client passes back the id
 * and original filename from step 1; the storage key is re-derived server-side
 * (never trusted from the client) so it always matches where the bytes went.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!canManageDocuments(user.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
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
  const category = str(body.category);
  const description = str(body.description);
  const originalFilename = str(body.originalFilename);
  const contentType = str(body.contentType) || "application/octet-stream";
  const minRank = body.minRank;
  const status = body.status;
  const sizeBytes = typeof body.sizeBytes === "number" ? body.sizeBytes : NaN;

  const errors: string[] = [];
  if (!id) errors.push("id is required.");
  if (!title) errors.push("title is required.");
  if (!category) errors.push("category is required.");
  if (!originalFilename) errors.push("originalFilename is required.");
  if (minRank !== 1 && minRank !== 2 && minRank !== 3) {
    errors.push("minRank must be 1, 2, or 3.");
  }
  if (status !== "draft" && status !== "published") {
    errors.push("status must be draft or published.");
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
    errors.push("sizeBytes must be a non-negative number.");
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  }

  const doc = await createDocument({
    id,
    title,
    description: description || undefined,
    category,
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
