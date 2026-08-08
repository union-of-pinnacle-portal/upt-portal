import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import {
  documentKind,
  listVisibleForUser,
  type PortalDocument,
} from "@/lib/documents";
import { documentCategories } from "@/lib/categories";
import {
  DocumentsTable,
  type DocumentRow,
} from "@/components/documents-table";
import { listCategoryNames } from "@/lib/category-store";
import {
  canCreateRooms,
  listRooms,
  listWritableRooms,
  writesEverywhere,
  type CommitteeRoom,
} from "@/lib/rooms";
import { AppHeader } from "@/components/app-header";
import { UploadDocumentDialog } from "@/components/upload-document-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { rankForRole } from "@/lib/roles";

// Documents come from DynamoDB per-request; never statically cache this page.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/login");
  }

  const managesEverything = writesEverywhere(user.role);

  // Which rooms this user may write in drives both the upload action and
  // whether they see their rooms' drafts. Isolate a data-store outage so the
  // portal still renders (and tells the user) instead of throwing a 500.
  let documents: PortalDocument[] = [];
  let writableRooms: CommitteeRoom[] = [];
  let allRooms: CommitteeRoom[] = [];
  let categoryOptions: string[] = [];
  let loadError = false;
  try {
    // Every room, not just writable ones: reads are global, so a document the
    // user may read can sit in a room they don't belong to, and it still needs
    // a name in the Room column.
    [writableRooms, allRooms, categoryOptions] = await Promise.all([
      listWritableRooms(user),
      listRooms(),
      listCategoryNames(),
    ]);
    documents = await listVisibleForUser({
      rank: user.rank,
      manageableRoomIds: new Set(writableRooms.map((r) => r.id)),
      managesEverything,
    });
  } catch {
    loadError = true;
  }

  const roomName = new Map(allRooms.map((r) => [r.id, r.name]));

  // Super Users can always upload (they may leave a document unfiled, which is
  // also how the very first upload happens before any room exists). Everyone
  // else needs at least one room they belong to.
  const canUpload = rankForRole(user.role) >= 3;

  // Edit is decided per document, not per user: a Chair may manage documents in
  // their own rooms while merely reading everything else on the same page.
  const writableRoomIds = new Set(writableRooms.map((r) => r.id));
  const canEditDoc = (doc: PortalDocument) =>
    managesEverything ||
    (doc.roomId !== undefined && writableRoomIds.has(doc.roomId));

  // Flatten to plain rows here, on the server. The table is a client component
  // and must never be handed a raw document or asked to decide permissions.
  const rows: DocumentRow[] = documents.map((doc) => ({
    id: doc.id,
    title: doc.title,
    description: doc.description,
    kind: documentKind(doc),
    roomId: doc.roomId,
    // An unknown id means the room was deleted out from under the document;
    // say so rather than leaving a blank that reads as "unfiled".
    roomName: doc.roomId ? (roomName.get(doc.roomId) ?? "Unknown room") : null,
    categories: documentCategories(doc),
    status: doc.status,
    updatedAt: doc.updatedAt,
    originalFilename: doc.originalFilename,
    minRank: doc.minRank,
    canEdit: canEditDoc(doc),
    // Deleting is Super-User-only, deliberately stricter than editing.
    canDelete: managesEverything,
  }));

  // The management columns appear if the user can manage *anything* here.
  const showManagement = canUpload && rows.some((r) => r.canEdit);

  return (
    <div className="min-h-svh bg-muted/30">
      <AppHeader>
        {canCreateRooms(user.role) || writableRooms.length > 0 ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/rooms">Committee rooms</Link>
          </Button>
        ) : null}
        {user.rank >= 3 ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/users">Manage members</Link>
          </Button>
        ) : null}
        {canUpload ? (
          <UploadDocumentDialog
            rooms={writableRooms}
            categoryOptions={categoryOptions}
            canFileUnfiled={managesEverything}
          />
        ) : null}
      </AppHeader>

      <main className="mx-auto w-full max-w-[100rem] px-6 py-8 lg:px-10">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        </div>

        {loadError ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-destructive">
              Documents are temporarily unavailable. Please try again shortly.
            </CardContent>
          </Card>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              {canUpload
                ? "No documents yet. Use “Upload document” to add the first one."
                : "No documents are available to your role yet."}
            </CardContent>
          </Card>
        ) : (
          <DocumentsTable
            rows={rows}
            rooms={allRooms}
            showUnfiled={rows.some((r) => !r.roomId)}
            showManagement={showManagement}
            categoryOptions={categoryOptions}
          />
        )}
      </main>
    </div>
  );
}
