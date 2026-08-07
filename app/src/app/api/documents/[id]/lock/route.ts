import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canWriteInRoom } from "@/lib/rooms";
import { documentKind, getDocument } from "@/lib/documents";
import { acquireLock, releaseLock } from "@/lib/document-locks";

/**
 * POST   /api/documents/:id/lock — take or renew the advisory edit lease
 * DELETE /api/documents/:id/lock — give it up
 *
 * Only people who could edit the document anyway may hold its lock, so that
 * the lock cannot be used to tell whether a document exists, nor to block an
 * editor by someone with no business editing.
 */
async function loadEditable(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };

  const doc = await getDocument(id);
  if (!doc || documentKind(doc) !== "page") {
    return { error: NextResponse.json({ error: "Not found." }, { status: 404 }) };
  }
  if (!(await canWriteInRoom(user, doc.roomId))) {
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
  }
  return { user };
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const loaded = await loadEditable(id);
  if (loaded.error) return loaded.error;

  const { ok, lock } = await acquireLock(id, loaded.user.email);
  return NextResponse.json({
    ok,
    heldBy: lock.heldBy,
    // Whether the caller may edit, which is the only thing the client acts on.
    mine: lock.heldBy === loaded.user.email,
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const loaded = await loadEditable(id);
  if (loaded.error) return loaded.error;

  await releaseLock(id, loaded.user.email);
  return NextResponse.json({ ok: true });
}
