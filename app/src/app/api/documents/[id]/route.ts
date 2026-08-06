import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { isRank, RANKS } from "@/lib/roles";
import { canWriteInRoom } from "@/lib/rooms";
import {
  getDocument,
  updateDocument,
  type UpdateDocumentInput,
} from "@/lib/documents";
import { resolveCategories } from "@/lib/category-store";

/**
 * PATCH /api/documents/:id
 *
 * Metadata management: edit title/description/category, change the allowed
 * rank, and move between draft/published/archived (publish, unpublish,
 * archive). Only the provided fields change.
 *
 * Authorization is scoped to the document's own Committee Room — the caller
 * must be able to write *that* room, not merely hold a senior role. The room
 * itself is not editable here (see UpdateDocumentInput).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const patch: UpdateDocumentInput = {};
  const errors: string[] = [];

  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) errors.push("title cannot be empty.");
    else patch.title = title;
  }
  // `categories` is deliberately NOT resolved here: resolving can create new
  // categories, so it has to wait until after the room write check below.
  if (body.description !== undefined) {
    patch.description =
      typeof body.description === "string" ? body.description.trim() : "";
  }
  if (body.minRank !== undefined) {
    if (!isRank(body.minRank)) {
      errors.push(`minRank must be one of ${RANKS.join(", ")}.`);
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
  if (body.categories === undefined && Object.keys(patch).length === 0) {
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

  // Room-scoped write check, against the room the document actually lives in.
  if (!(await canWriteInRoom(user, existing.roomId))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  if (body.categories !== undefined) {
    const resolved = await resolveCategories(body.categories, user.email);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }
    patch.categories = resolved.categories;
  }

  const updated = await updateDocument(id, patch);
  if (!updated) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({ id: updated.id, status: updated.status });
}
