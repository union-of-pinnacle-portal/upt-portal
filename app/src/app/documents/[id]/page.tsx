import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { canViewRank } from "@/lib/roles";
import { canWriteInRoom } from "@/lib/rooms";
import { documentKind, getDocument, readPageContent } from "@/lib/documents";
import { getLock } from "@/lib/document-locks";
import { documentCategories } from "@/lib/categories";
import { listCategoryNames } from "@/lib/category-store";
import { EditDocumentDialog } from "@/components/edit-document-dialog";
import { AppHeader } from "@/components/app-header";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { PageEditor } from "@/components/editor/page-editor";
import { DownloadPdfButton } from "@/components/download-pdf-button";

export const dynamic = "force-dynamic";

/**
 * A portal-authored document: read it, or edit it in place.
 *
 * There is no separate view and edit route. Whether the editor is writable is
 * decided here from room membership and the advisory lock, and the same
 * component renders both — so a reader and a writer see identical formatting,
 * and there is no second rendering path to drift.
 *
 * Access is enforced here, not in the client: middleware only checks that a
 * session exists.
 */
export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/login");
  }

  const { id } = await params;
  const doc = await getDocument(id);
  if (!doc) {
    notFound();
  }

  // Uploaded files have no in-portal body; send them to the download endpoint,
  // which re-runs these same checks.
  if (documentKind(doc) !== "page") {
    redirect(`/api/documents/${id}/download`);
  }

  const canWrite = await canWriteInRoom(user, doc.roomId);

  // Same gate as downloading a file: rank must clear minRank, and unpublished
  // documents are visible only to whoever manages the room.
  if (!canWrite && doc.status !== "published") {
    notFound();
  }
  if (!canViewRank(user.role, doc.minRank)) {
    notFound();
  }

  const [content, lock] = await Promise.all([
    readPageContent(doc),
    getLock(id),
  ]);
  const lockedByOther =
    lock && lock.heldBy !== user.email ? lock.heldBy : null;

  return (
    <div className="min-h-svh bg-muted/30">
      <AppHeader>
        <DownloadPdfButton />
        {/* Metadata lives here rather than in the table, so a page document has
            one destination for everything about it. */}
        {canWrite ? (
          <EditDocumentDialog
            trigger="Details"
            triggerStyle="button"
            categoryOptions={await listCategoryNames()}
            doc={{
              id: doc.id,
              title: doc.title,
              description: doc.description,
              categories: documentCategories(doc),
              minRank: doc.minRank,
              status: doc.status,
              originalFilename: doc.originalFilename,
            }}
          />
        ) : null}
      </AppHeader>

      <main className="mx-auto w-full max-w-[100rem] px-6 py-8 lg:px-10">
        <div className="print-hide">
          <PageBreadcrumb trail={[{ label: doc.title }]} />
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">{doc.title}</h1>
          {doc.description ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {doc.description}
            </p>
          ) : null}
          <p className="mt-2 flex flex-wrap gap-1">
            {documentCategories(doc).map((category) => (
              <span
                key={category}
                className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {category}
              </span>
            ))}
          </p>
        </div>

        <PageEditor
          documentId={doc.id}
          initialContent={content}
          canEdit={canWrite}
          lockedBy={lockedByOther}
        />
      </main>
    </div>
  );
}
