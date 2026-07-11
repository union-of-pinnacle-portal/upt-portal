import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canManageDocuments } from "@/lib/roles";
import { getUploadUrl } from "@/lib/aws/s3";
import { buildStorageKey } from "@/lib/documents";

/**
 * POST /api/documents/upload-url
 *
 * Step 1 of the admin upload flow. Only committee heads may call it. Mints a
 * new document id and a short-lived presigned URL the browser PUTs the file
 * to directly, so large uploads never pass through the app server. The
 * document metadata is not written until step 2 (POST /api/documents).
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!canManageDocuments(user.role)) {
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
    return NextResponse.json({ error: "filename is required." }, { status: 400 });
  }

  const id = randomUUID();
  const storageKey = buildStorageKey(id, filename);
  const uploadUrl = await getUploadUrl(storageKey, contentType);

  return NextResponse.json({ id, uploadUrl, contentType });
}
