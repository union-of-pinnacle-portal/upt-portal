import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canWriteInRoom } from "@/lib/rooms";
import { documentKind, getDocument, savePageContent } from "@/lib/documents";

/** Matches the editor's own save limit. */
const MAX_CONTENT_BYTES = 2_000_000;

/**
 * POST /api/documents/:id/convert
 *
 * Turn an uploaded file into a portal-authored document, so it can be edited
 * in the browser.
 *
 * THE ORIGINAL FILE IS NOT DESTROYED. The conversion is written as a new
 * version, which backfills the original as version 1 first — so the .docx a
 * member uploaded stays downloadable from the history forever, and a bad
 * conversion is recoverable.
 *
 * The docx→HTML→editor conversion happens in the BROWSER, not here. Lexical
 * builds its state from a DOM, which the server does not have without pulling
 * in jsdom; the client already has one. So this route receives finished editor
 * JSON and is not itself a converter — it validates, authorizes, and commits.
 * That does mean the conversion is only as trustworthy as any other client
 * write, which is fine: the caller could equally have typed this content in by
 * hand, and needs the same permission either way.
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

  if (documentKind(doc) === "page") {
    return NextResponse.json(
      { error: "This is already an editable document." },
      { status: 409 },
    );
  }

  let body: { content?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const content = typeof body.content === "string" ? body.content : "";
  if (!content) {
    return NextResponse.json({ error: "content is required." }, { status: 400 });
  }
  if (Buffer.byteLength(content, "utf8") > MAX_CONTENT_BYTES) {
    return NextResponse.json(
      { error: "This document is too large to convert." },
      { status: 413 },
    );
  }
  try {
    JSON.parse(content);
  } catch {
    return NextResponse.json({ error: "content must be JSON." }, { status: 400 });
  }

  const saved = await savePageContent(doc, content, user.email, "page");
  if (!saved) {
    return NextResponse.json(
      { error: "Someone else changed this document. Reload and try again." },
      { status: 409 },
    );
  }

  return NextResponse.json({ version: saved.version });
}
