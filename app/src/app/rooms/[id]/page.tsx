import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import {
  canAssignInRoom,
  canWriteInRoom,
  getRoom,
  isRoomMember,
  listRoomMembers,
  writesEverywhere,
} from "@/lib/rooms";
import { listVisibleForUser, type DocumentStatus } from "@/lib/documents";
import { AppHeader } from "@/components/app-header";
import { RoomMemberManager } from "@/components/room-member-manager";
import { EditDocumentDialog } from "@/components/edit-document-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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

  return (
    <div className="min-h-svh bg-muted/30">
      <AppHeader>
        <Button asChild variant="outline" size="sm">
          <Link href="/rooms">All rooms</Link>
        </Button>
      </AppHeader>

      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">{room.name}</h1>
          {room.description ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {room.description}
            </p>
          ) : null}
        </div>

        <Card className="mb-6">
          <CardContent className="py-6">
            <h2 className="mb-1 text-sm font-medium">Documents</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Filed to this room. You see these on the main documents list too —
              a room does not hide anything.
            </p>

            {documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No documents filed to this room yet.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[30rem] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3">Title</th>
                      <th className="px-4 py-3">Category</th>
                      {canWrite ? <th className="px-4 py-3">Status</th> : null}
                      <th className="px-4 py-3 whitespace-nowrap">Updated</th>
                      {canWrite ? (
                        <th className="px-4 py-3 text-right">Actions</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
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
                        </td>
                        <td className="px-4 py-3 align-top text-muted-foreground">
                          {doc.category}
                        </td>
                        {canWrite ? (
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
                        {canWrite ? (
                          <td className="px-4 py-3 align-top text-right">
                            <EditDocumentDialog
                              doc={{
                                id: doc.id,
                                title: doc.title,
                                description: doc.description,
                                category: doc.category,
                                minRank: doc.minRank,
                                status: doc.status,
                                originalFilename: doc.originalFilename,
                              }}
                            />
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-6">
            <h2 className="mb-1 text-sm font-medium">Members</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Members can upload and edit documents filed to this room. This
              does not change their role or what they can read elsewhere.
            </p>

            {canAssign ? (
              <RoomMemberManager roomId={room.id} members={members} />
            ) : members.length === 0 ? (
              <p className="text-sm text-muted-foreground">No members yet.</p>
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
      </main>
    </div>
  );
}
