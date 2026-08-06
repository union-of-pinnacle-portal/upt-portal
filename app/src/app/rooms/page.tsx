import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import {
  canCreateRooms,
  listRoomMembers,
  listRooms,
  listWritableRooms,
  writesEverywhere,
} from "@/lib/rooms";
import { listVisibleForUser } from "@/lib/documents";
import { AppHeader } from "@/components/app-header";
import { CreateRoomDialog } from "@/components/create-room-form";
import { Button } from "@/components/ui/button";
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
  } catch {
    loadError = true;
  }

  const plural = (n: number, word: string) =>
    `${n} ${word}${n === 1 ? "" : "s"}`;

  return (
    <div className="min-h-svh bg-muted/30">
      <AppHeader>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard">Documents</Link>
        </Button>
        {canCreateRooms(user.role) ? <CreateRoomDialog /> : null}
      </AppHeader>

      <main className="mx-auto w-full max-w-6xl px-6 py-8">
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
          <ul className="grid gap-3">
            {rooms.map((room) => (
              <li key={room.id}>
                <Link
                  href={`/rooms/${room.id}`}
                  className="block rounded-lg border border-border bg-background px-4 py-4 hover:bg-muted/40"
                >
                  <p className="font-medium">{room.name}</p>
                  {room.description ? (
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                      {room.description}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted-foreground">
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
