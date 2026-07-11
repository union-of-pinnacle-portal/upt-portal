import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canManageDocuments } from "@/lib/roles";
import {
  getDocument,
  updateDocument,
  type UpdateDocumentInput,
} from "@/lib/documents";

/**
 * PATCH /api/documents/:id
 *
 * Admin metadata management: edit title/description/category, change the
 * allowed rank, and move between draft/published/archived (publish, unpublish,
 * archive). Committee heads only. Only the provided fields change.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const patch: UpdateDocumentInput = {};
  const errors: string[] = [];

  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) errors.push("title cannot be empty.");
    else patch.title = title;
  }
  if (body.category !== undefined) {
    const category = String(body.category).trim();
    if (!category) errors.push("category cannot be empty.");
    else patch.category = category;
  }
  if (body.description !== undefined) {
    patch.description =
      typeof body.description === "string" ? body.description.trim() : "";
  }
  if (body.minRank !== undefined) {
    if (body.minRank !== 1 && body.minRank !== 2 && body.minRank !== 3) {
      errors.push("minRank must be 1, 2, or 3.");
    } else {
      patch.minRank = body.minRank;
    }
  }
  if (body.status !== undefined) {
    if (
      body.status !== "draft" &&
      body.status !== "published" &&
      body.status !== "archived"
    ) {
      errors.push("status must be draft, published, or archived.");
    } else {
      patch.status = body.status;
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "No editable fields provided." },
      { status: 400 },
    );
  }

  const { id } = await params;
  const existing = await getDocument(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const updated = await updateDocument(id, patch);
  if (!updated) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({ id: updated.id, status: updated.status });
}
