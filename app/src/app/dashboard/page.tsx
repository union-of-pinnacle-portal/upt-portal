import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import {
  listVisibleForUser,
  type DocumentStatus,
  type PortalDocument,
} from "@/lib/documents";
import { ROLE_LABEL } from "@/lib/roles";
import { documentCategories } from "@/lib/categories";
import { listCategoryNames } from "@/lib/category-store";
import {
  canCreateRooms,
  listRooms,
  listWritableRooms,
  writesEverywhere,
  type CommitteeRoom,
} from "@/lib/rooms";
import { RoomFilter, UNFILED } from "@/components/room-filter";
import { AppHeader } from "@/components/app-header";
import { EditDocumentDialog } from "@/components/edit-document-dialog";
import { UploadDocumentDialog } from "@/components/upload-document-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Documents come from DynamoDB per-request; never statically cache this page.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

const STATUS_STYLE: Record<DocumentStatus, string> = {
  published: "bg-brand text-brand-foreground",
  draft: "bg-muted text-muted-foreground",
  archived: "bg-destructive/10 text-destructive",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; room?: string }>;
}) {
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

  // Room filter. `UNFILED` selects documents with no room at all; an unknown
  // value falls through to showing everything rather than an empty table.
  const params = await searchParams;
  const selectedRoom = params.room ?? "";
  const filtered =
    selectedRoom === UNFILED
      ? documents.filter((d) => d.roomId === undefined)
      : selectedRoom && roomName.has(selectedRoom)
        ? documents.filter((d) => d.roomId === selectedRoom)
        : documents;

  // Super Users can always upload (they may leave a document unfiled, which is
  // also how the very first upload happens before any room exists). Everyone
  // else needs at least one room they belong to.
  const canUpload = managesEverything || writableRooms.length > 0;

  // Offset pagination over the sorted result. Fine for the realistic corpus
  // (hundreds of docs); if it ever grows into the many-thousands, swap to
  // cursor-based DynamoDB paging without changing this UI.
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const requested = Number.parseInt(params.page ?? "1", 10);
  const page = Math.min(
    Math.max(Number.isNaN(requested) ? 1 : requested, 1),
    totalPages,
  );
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Edit is decided per document, not per user: a Chair may manage documents in
  // their own rooms while merely reading everything else on the same page.
  const writableRoomIds = new Set(writableRooms.map((r) => r.id));
  const canEdit = (doc: PortalDocument) =>
    managesEverything ||
    (doc.roomId !== undefined && writableRoomIds.has(doc.roomId));

  // The management columns appear if the user can manage *anything* here.
  const showManagement = canUpload && pageItems.some(canEdit);

  // Paging must carry the active room filter, or turning the page silently
  // drops it and shows a different result set than the one being paged.
  const pageHref = (n: number) => {
    const qs = new URLSearchParams({ page: String(n) });
    if (selectedRoom) qs.set("room", selectedRoom);
    return `/dashboard?${qs}`;
  };

  return (
    <div className="min-h-svh bg-muted/30">
      <AppHeader>
        {canCreateRooms(user.role) || writableRooms.length > 0 ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/rooms">Committee rooms</Link>
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

      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
          <p className="text-sm text-muted-foreground">
            Signed in as {user.email || "your account"} ·{" "}
            <span className="font-medium text-foreground">
              {ROLE_LABEL[user.role]}
            </span>
          </p>
        </div>

        {loadError ? null : (
          <RoomFilter
            rooms={allRooms}
            selected={selectedRoom}
            showUnfiled={documents.some((d) => d.roomId === undefined)}
          />
        )}

        {loadError ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-destructive">
              Documents are temporarily unavailable. Please try again shortly.
            </CardContent>
          </Card>
        ) : total === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              {selectedRoom
                ? "No documents in this room yet."
                : canUpload
                  ? "No documents yet. Use “Upload document” to add the first one."
                  : "No documents are available to your role yet."}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-border bg-background">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Room</th>
                    <th className="px-4 py-3">Categories</th>
                    {showManagement ? (
                      <th className="px-4 py-3">Status</th>
                    ) : null}
                    <th className="px-4 py-3 whitespace-nowrap">Last updated</th>
                    {showManagement ? (
                      <th className="px-4 py-3 text-right">Actions</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((doc) => (
                    <tr
                      key={doc.id}
                      className="border-b border-border/60 last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-4 py-3 align-top">
                        <a
                          href={`/api/documents/${doc.id}/download`}
                          className="font-medium hover:underline"
                        >
                          {doc.title}
                        </a>
                        {doc.description ? (
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                            {doc.description}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap text-muted-foreground">
                        {doc.roomId ? (
                          // Unknown id means the room was deleted out from
                          // under the document; show the raw state rather than
                          // an empty cell that reads as "unfiled".
                          (roomName.get(doc.roomId) ?? "Unknown room")
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap gap-1">
                          {documentCategories(doc).map((category) => (
                            <span
                              key={category}
                              className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground whitespace-nowrap"
                            >
                              {category}
                            </span>
                          ))}
                        </div>
                      </td>
                      {showManagement ? (
                        <td className="px-4 py-3 align-top">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLE[doc.status]}`}
                          >
                            {doc.status}
                          </span>
                        </td>
                      ) : null}
                      <td className="px-4 py-3 align-top whitespace-nowrap text-muted-foreground">
                        {formatDate(doc.updatedAt)}
                      </td>
                      {showManagement ? (
                        <td className="px-4 py-3 align-top text-right">
                          {canEdit(doc) ? (
                            <EditDocumentDialog
                              categoryOptions={categoryOptions}
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
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4 text-sm text-muted-foreground">
              <span>
                {total} document{total === 1 ? "" : "s"} · Page {page} of{" "}
                {totalPages}
              </span>
              {totalPages > 1 ? (
                <div className="flex gap-2">
                  {page > 1 ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href={pageHref(page - 1)}>Previous</Link>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled>
                      Previous
                    </Button>
                  )}
                  {page < totalPages ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href={pageHref(page + 1)}>Next</Link>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled>
                      Next
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
