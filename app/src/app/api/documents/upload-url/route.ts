import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { roleCanWrite } from "@/lib/rooms";
import { getUploadUrl } from "@/lib/aws/s3";
import { buildStorageKey } from "@/lib/documents";

/**
 * POST /api/documents/upload-url
 *
 * Step 1 of the upload flow. Mints a new document id and a short-lived
 * presigned URL the browser PUTs the file to directly, so large uploads never
 * pass through the app server. The document metadata is not written until
 * step 2 (POST /api/documents).
 *
 * This is gated on the role being *capable* of writing at all, not on any
 * particular room — the target room isn't chosen until step 2, which is where
 * room membership is enforced. An orphaned S3 object is the worst a caller can
 * achieve here: without a matching step-2 write, no document ever references
 * it and it is invisible to the portal.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!roleCanWrite(user.role)) {
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
