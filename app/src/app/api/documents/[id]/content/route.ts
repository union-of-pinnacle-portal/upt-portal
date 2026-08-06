import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canViewRank } from "@/lib/roles";
import { canWriteInRoom } from "@/lib/rooms";
import { getDocument, documentKind, buildContentKey } from "@/lib/documents";
import { s3 } from "@/lib/aws/s3";
import { DOCUMENTS_BUCKET } from "@/lib/aws/config";
import {
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

/**
 * GET /api/documents/:id/content
 *
 * Load the Lexical JSON body of a page document.
 * Same rank-based read gate as the download endpoint.
 * Returns { content: SerializedEditorState } or 404/empty for a new page.
 */
export async function GET(
  _req: NextRequest,
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
  if (!canViewRank(user.role, doc.minRank)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  if (documentKind(doc) !== "page") {
    return NextResponse.json(
      { error: "Document is not a page." },
      { status: 400 },
    );
  }

  try {
    const res = await s3.send(
      new GetObjectCommand({
        Bucket: DOCUMENTS_BUCKET,
        Key: buildContentKey(id),
      }),
    );
    const body = await res.Body?.transformToString();
    const content = body ? JSON.parse(body) : null;
    return NextResponse.json({ content });
  } catch (err) {
    // NoSuchKey means the page was just created and has no content yet
    if ((err as { name?: string }).name === "NoSuchKey") {
      return NextResponse.json({ content: null });
    }
    throw err;
  }
}

/**
 * PUT /api/documents/:id/content
 *
 * Save Lexical JSON to S3. Write gate: same room-scoped check as metadata edits.
 * Body: { content: SerializedEditorState }
 */
export async function PUT(
  req: NextRequest,
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
  if (documentKind(doc) !== "page") {
    return NextResponse.json(
      { error: "Document is not a page." },
      { status: 400 },
    );
  }
  if (!(await canWriteInRoom(user, doc.roomId))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let body: { content: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!body.content) {
    return NextResponse.json({ error: "content is required." }, { status: 400 });
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: DOCUMENTS_BUCKET,
      Key: buildContentKey(id),
      Body: JSON.stringify(body.content),
      ContentType: "application/json",
    }),
  );

  return NextResponse.json({ ok: true });
}
