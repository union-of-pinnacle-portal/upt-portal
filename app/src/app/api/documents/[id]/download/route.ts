import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getDocument, getVersion } from "@/lib/documents";
import { getDownloadUrl, getObjectBytes } from "@/lib/aws/s3";
import { canViewRank } from "@/lib/roles";
import { canWriteInRoom } from "@/lib/rooms";

/**
 * GET /api/documents/:id/download
 *
 * The single enforcement point for document access. Even if a member guesses
 * or is handed a document id, they get a file only when the server confirms
 * their rank clears the document's `minRank`. Unauthorized ids return 404
 * (not 403) so the endpoint never reveals that a restricted document exists.
 *
 * On success we mint a short-lived presigned S3 URL and redirect to it — the
 * private bucket is never exposed directly.
 */
export async function GET(
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

  // Whoever may write a document's room may also download it in any state,
  // including the drafts and archived items they are managing. Everyone else
  // sees published documents only, and unpublished/archived/missing ones all
  // return an identical 404 so their existence can't be probed.
  const canManage = await canWriteInRoom(user, doc.roomId);
  if (!canManage && doc.status !== "published") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // Core RBAC check: the member's rank must clear the document's minRank.
  // This is deliberately NOT waived for room managers — rooms scope writes,
  // never reads, so a rank-2 Committee Member managing a room still cannot
  // read a document restricted to rank 3 or above within it.
  if (!canViewRank(user.role, doc.minRank)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // `?inline=1` streams the bytes through this server instead of redirecting.
  // The docx converter must read the file from JavaScript, and a same-origin
  // read cannot be tripped up by bucket CORS or by redirect following.
  const url = new URL(req.url);
  if (url.searchParams.get("inline") === "1") {
    const bytes = await getObjectBytes(doc.storageKey);
    if (!bytes) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": doc.contentType || "application/octet-stream",
        "Content-Length": String(bytes.byteLength),
      },
    });
  }

  // `?version=n` serves an older revision, resolved AFTER the checks above —
  // all of which are properties of the document rather than of any one file —
  // so an old version is never reachable by someone who could not reach the
  // current one.
  const requested = url.searchParams.get("version");
  if (requested !== null) {
    const version = Number.parseInt(requested, 10);
    if (!Number.isInteger(version) || version < 1) {
      return NextResponse.json({ error: "Bad version." }, { status: 400 });
    }
    const found = await getVersion(doc, version);
    if (!found) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return NextResponse.redirect(await getDownloadUrl(found.storageKey));
  }

  return NextResponse.redirect(await getDownloadUrl(doc.storageKey));
}
