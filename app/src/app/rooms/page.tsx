import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import {
  canCreateRooms,
  listRoomMembers,
  listRooms,
  listRoomsForUser,
  listWritableRooms,
  writesEverywhere,
} from "@/lib/rooms";
import { listVisibleForUser } from "@/lib/documents";
import { AppHeader } from "@/components/app-header";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { CreateRoomDialog } from "@/components/create-room-form";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

/**
 * Committee Rooms index.
 *
 * Super Users see every room and can create more. Everyone else sees only the
 * rooms they belong to, because a room they cannot write in gives them nothing
 * they don't already have from the documents list — reads are global.
 */
export default async function RoomsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/login");
  }

  const seesAllRooms = writesEverywhere(user.role);

  let rooms: Awaited<ReturnType<typeof listRooms>> = [];
  let docCount = new Map<string, number>();
  let memberCount = new Map<string, number>();
  let myRoomIds = new Set<string>();
  let loadError = false;
  try {
    rooms = seesAllRooms ? await listRooms() : await listWritableRooms(user);

    // Counts are computed from what THIS user may see, so the card never hints
    // at documents their rank excludes. One roster query per room is fine at
    // committee scale (a handful of rooms).
    const [documents, rosters] = await Promise.all([
      listVisibleForUser({
        rank: user.rank,
        manageableRoomIds: new Set(rooms.map((r) => r.id)),
        managesEverything: seesAllRooms,
      }),
      Promise.all(rooms.map((r) => listRoomMembers(r.id))),
    ]);

    docCount = documents.reduce((acc, doc) => {
      if (doc.roomId) acc.set(doc.roomId, (acc.get(doc.roomId) ?? 0) + 1);
      return acc;
    }, new Map<string, number>());

    memberCount = new Map(
      rooms.map((room, i) => [room.id, rosters[i].length]),
    );

    // Which of these the viewer actually belongs to. Only meaningful for Super
    // Users, who see every room — for everyone else the list IS their rooms.
    if (seesAllRooms) {
      myRoomIds = new Set(
        (await listRoomsForUser(user.email)).map((m) => m.roomId),
      );
    }
  } catch {
    loadError = true;
  }

  const plural = (n: number, word: string) =>
    `${n} ${word}${n === 1 ? "" : "s"}`;

  return (
    <div className="min-h-svh bg-muted/30">
      <AppHeader>
        {canCreateRooms(user.role) ? <CreateRoomDialog /> : null}
      </AppHeader>

      <main className="mx-auto w-full max-w-[100rem] px-6 py-8 lg:px-10">
        <PageBreadcrumb trail={[{ label: "Committee rooms" }]} />

        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            Committee rooms
          </h1>
          <p className="text-sm text-muted-foreground">
            Rooms control who can upload and edit documents. They do not affect
            who can read them.
          </p>
        </div>

        {loadError ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-destructive">
              Rooms are temporarily unavailable. Please try again shortly.
            </CardContent>
          </Card>
        ) : rooms.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              {canCreateRooms(user.role)
                ? "No rooms yet. Use “New room” to create the first one."
                : "You have not been added to any committee rooms yet."}
            </CardContent>
          </Card>
        ) : (
          // Cards in a responsive grid rather than a single column: a room
          // card is a short block, and stretching one across a wide page
          // leaves most of the row empty.
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rooms.map((room) => (
              <li key={room.id}>
                <Link
                  href={`/rooms/${room.id}`}
                  className="flex h-full flex-col rounded-lg border border-border bg-background px-4 py-4 hover:bg-muted/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{room.name}</p>
                    {myRoomIds.has(room.id) ? (
                      // Membership is what grants write access, so it is worth
                      // showing on a list where a Super User sees every room.
                      <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
                        Member
                      </span>
                    ) : null}
                  </div>
                  {room.description ? (
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                      {room.description}
                    </p>
                  ) : null}
                  <p className="mt-auto pt-3 text-xs text-muted-foreground">
                    {plural(docCount.get(room.id) ?? 0, "document")} ·{" "}
                    {plural(memberCount.get(room.id) ?? 0, "member")}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
