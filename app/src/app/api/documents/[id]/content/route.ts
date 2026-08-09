import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canViewRank } from "@/lib/roles";
import { canWriteInRoom } from "@/lib/rooms";
import {
  currentVersionNumber,
  documentKind,
  getDocument,
  readPageContent,
  savePageContent,
} from "@/lib/documents";
import { refreshLock } from "@/lib/document-locks";

/** Editor content is JSON; anything much larger than this is not a document. */
const MAX_CONTENT_BYTES = 2_000_000;

/**
 * GET /api/documents/:id/content
 *
 * The editor content of a page document. Gated exactly like downloading a
 * file: rank must clear `minRank`, and unpublished documents are visible only
 * to whoever may write the room. Reading a page must never be easier than
 * downloading the equivalent file.
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
  if (!doc || documentKind(doc) !== "page") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const canManage = await canWriteInRoom(user, doc.roomId);
  if (!canManage && doc.status !== "published") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (!canViewRank(user.role, doc.minRank)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // A page with no content object yet reads as empty rather than failing —
  // see readPageContent.
  return NextResponse.json({ content: await readPageContent(doc) });
}

/**
 * PUT /api/documents/:id/content
 *
 * Save the editor content as a new version. Requires write access to the
 * document's Committee Room, the same as every other change to it.
 *
 * Concurrency is handled by `baseVersion`, not by the lock. The editor sends
 * the version it loaded; if the document has moved on since, the save is
 * refused with a 409 rather than quietly becoming the newest version. Without
 * this, two people who both opened the document before either saved would each
 * write a fresh version, and whoever saved last would silently replace the
 * other's work. The lock prevents that happening in the first place, but it is
 * only a hint — this is the check that makes losing an edit impossible.
 *
 * The edit lock is advisory and deliberately NOT enforced here: a lock exists
 * to stop two people unknowingly working in parallel, not to authorize the
 * write. Refusing a save because a lease expired mid-edit would throw away
 * someone's work to uphold a hint. The save is refreshed onto the lock instead,
 * so an active writer keeps holding it.
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await params;
  const doc = await getDocument(id);
  if (!doc || documentKind(doc) !== "page") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (!(await canWriteInRoom(user, doc.roomId))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let body: { content?: unknown; baseVersion?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const content = typeof body.content === "string" ? body.content : "";
  if (!content) {
    return NextResponse.json(
      { error: "content is required." },
      { status: 400 },
    );
  }
  if (Buffer.byteLength(content, "utf8") > MAX_CONTENT_BYTES) {
    return NextResponse.json(
      { error: "This document is too large to save." },
      { status: 413 },
    );
  }
  // Reject anything that isn't a JSON object before it reaches storage — a
  // malformed body would otherwise only surface when the editor next opens.
  try {
    JSON.parse(content);
  } catch {
    return NextResponse.json(
      { error: "content must be JSON." },
      { status: 400 },
    );
  }

  // Optimistic concurrency. Omitted by older clients, in which case we fall
  // back to the previous behaviour rather than refusing the save outright.
  if (typeof body.baseVersion === "number") {
    const current = await currentVersionNumber(id);
    if (body.baseVersion !== current) {
      return NextResponse.json(
        {
          error:
            "This document changed while you were editing it. Reload to see the current version — your text is still in the editor, so you can copy anything you need first.",
        },
        { status: 409 },
      );
    }
  }

  const saved = await savePageContent(doc, content, user.email);
  if (!saved) {
    return NextResponse.json(
      {
        error:
          "Someone else saved this document while you were editing. Reload to see their changes — your text is still in the editor.",
      },
      { status: 409 },
    );
  }

  await refreshLock(id, user.email);

  return NextResponse.json({ version: saved.version, savedAt: saved.uploadedAt });
}
