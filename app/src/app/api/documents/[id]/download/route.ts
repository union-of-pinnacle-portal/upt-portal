import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getDocument } from "@/lib/documents";
import { getDownloadUrl } from "@/lib/aws/s3";
import { canManageDocuments, canViewRank } from "@/lib/roles";

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
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await params;
  const doc = await getDocument(id);

  // Hide non-existent, archived, and (for non-admins) unpublished documents
  // behind an identical 404 so their existence can't be probed.
  const isAdmin = canManageDocuments(user.role);
  const viewable = doc && doc.status !== "archived" &&
    (doc.status === "published" || isAdmin);
  if (!viewable) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // Core RBAC check: the member's rank must clear the document's minRank.
  if (!canViewRank(user.role, doc.minRank)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const url = await getDownloadUrl(doc.storageKey);
  return NextResponse.redirect(url);
}
