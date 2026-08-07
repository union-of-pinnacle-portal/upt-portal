import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canWriteInRoom } from "@/lib/rooms";
import { getUploadUrl } from "@/lib/aws/s3";
import {
  buildVersionStorageKey,
  getDocument,
  nextVersionNumber,
} from "@/lib/documents";

/**
 * POST /api/documents/:id/versions/upload-url
 *
 * Step 1 of replacing a document's file. Reserves the next version number and
 * mints a presigned URL for that version's own object key, so the bytes go
 * straight to S3 without passing through the app server.
 *
 * Unlike the new-document upload-url route, this one CAN check room membership
 * up front, because the target document — and therefore its room — is already
 * known. Replacing a file is exactly as privileged as editing the document's
 * metadata, so it uses the same check.
 *
 * The version number is reserved optimistically, not locked. If two people
 * replace the same file at once they may both be handed the same number; the
 * conditional write in step 2 lets only one of them keep it, and the loser's
 * upload is left as an orphaned S3 object referenced by nothing.
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

  let body: { filename?: unknown; contentType?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const filename = typeof body.filename === "string" ? body.filename.trim() : "";
  const contentType =
    typeof body.contentType === "string" && body.contentType
      ? body.contentType
      : "application/octet-stream";

  if (!filename) {
    return NextResponse.json(
      { error: "filename is required." },
      { status: 400 },
    );
  }

  const version = await nextVersionNumber(id);
  const storageKey = buildVersionStorageKey(id, version, filename);
  const uploadUrl = await getUploadUrl(storageKey, contentType);

  return NextResponse.json({ version, uploadUrl, contentType });
}
