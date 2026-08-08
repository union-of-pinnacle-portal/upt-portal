import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import {
  canAssignInRoom,
  canWriteInRoom,
  getRoom,
  isRoomMember,
  listRoomMembers,
  writesEverywhere,
} from "@/lib/rooms";
import { documentKind, listVisibleForUser } from "@/lib/documents";
import { documentCategories } from "@/lib/categories";
import { listCategoryNames } from "@/lib/category-store";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { RoomMemberManager } from "@/components/room-member-manager";
import {
  DocumentsTable,
  type DocumentRow,
} from "@/components/documents-table";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, UserPlus } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * A single Committee Room: what it is, and who may write in it.
 *
 * Visible to Super Users and to the room's own members. Others get a 404 —
 * not because the room's *documents* are secret (reads are global and this
 * page lists none), but because a room's roster is internal to that committee.
 *
 * The roster is only editable by Super Users and the room's Chairs; members of
 * lower rank see it read-only.
 */
export default async function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/login");
  }

  const { id } = await params;
  const room = await getRoom(id);
  if (!room) {
    notFound();
  }

  const belongs = writesEverywhere(user.role) || (await isRoomMember(user.email, id));
  if (!belongs) {
    notFound();
  }

  const canAssign = await canAssignInRoom(user, id);
  const canWrite = await canWriteInRoom(user, id);
  const members = await listRoomMembers(id);
  const categoryOptions = canWrite ? await listCategoryNames() : [];

  // The room's documents, still bounded by the viewer's rank — a room page
  // never reveals anything the documents list wouldn't. Drafts and archived
  // items show only to those who may write here.
  const documents = (
    await listVisibleForUser({
      rank: user.rank,
      manageableRoomIds: canWrite ? new Set([id]) : new Set<string>(),
      managesEverything: writesEverywhere(user.role),
    })
  ).filter((doc) => doc.roomId === id);

  // Same server-side flattening as the dashboard: the table is a client
  // component and must never decide permissions for itself.
  const rows: DocumentRow[] = documents.map((doc) => ({
    id: doc.id,
    title: doc.title,
    description: doc.description,
    kind: documentKind(doc),
    roomId: doc.roomId,
    roomName: room.name,
    categories: documentCategories(doc),
    status: doc.status,
    updatedAt: doc.updatedAt,
    originalFilename: doc.originalFilename,
    minRank: doc.minRank,
    canEdit: canWrite,
    canDelete: writesEverywhere(user.role),
  }));

  return (
    <div className="min-h-svh bg-muted/30">
      <AppHeader />

      <main className="mx-auto w-full max-w-[100rem] px-6 py-8 lg:px-10">
        <PageBreadcrumb
          trail={[
            { label: "Committee rooms", href: "/rooms" },
            { label: room.name },
          ]}
        />

        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">{room.name}</h1>
          {room.description ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {room.description}
            </p>
          ) : null}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card>
            <CardContent className="py-6">
              <h2 className="mb-1 text-sm font-medium">Documents</h2>
              <p className="mb-4 text-xs text-muted-foreground">
                Filed to this room. You see these on the main documents list too
                — a room does not hide anything.
              </p>

              {rows.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No documents in this room"
                  description="Documents filed here appear in this list and on the main documents page."
                />
              ) : (
                // The same table as the dashboard, minus the Room column: every
                // row here is in this room, so it would repeat one value.
                <DocumentsTable
                  rows={rows}
                  rooms={[]}
                  showUnfiled={false}
                  showManagement={canWrite}
                  categoryOptions={categoryOptions}
                  showRoom={false}
                />
              )}
            </CardContent>
          </Card>

          <Card className="lg:self-start">
            <CardContent className="py-6">
              <h2 className="mb-1 text-sm font-medium">Members</h2>
              <p className="mb-4 text-xs text-muted-foreground">
                Members can upload and edit documents filed to this room. This
                does not change their role or what they can read elsewhere.
              </p>

              {canAssign ? (
                <RoomMemberManager roomId={room.id} members={members} />
              ) : members.length === 0 ? (
                <EmptyState
                  icon={UserPlus}
                  title="No members yet"
                  description="A Chair or Super User can add people to this room."
                />
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {members.map((member) => (
                    <li key={member.email} className="px-4 py-3 text-sm">
                      {member.email}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
