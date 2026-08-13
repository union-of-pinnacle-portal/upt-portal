import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canCreateRooms, deleteRoom, getRoom } from "@/lib/rooms";
import { listVisibleForUser, updateDocument } from "@/lib/documents";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!canCreateRooms(user.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await params;
  const room = await getRoom(id);
  if (!room) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // Unfile all documents in this room before deleting
  const allDocs = await listVisibleForUser({
    rank: 4,
    manageableRoomIds: new Set([id]),
    managesEverything: true,
  });
  const roomDocs = allDocs.filter((d) => d.roomId === id);
  for (const doc of roomDocs) {
    await updateDocument(doc.id, { roomId: null });
  }

  await deleteRoom(id);
  return NextResponse.json({ ok: true });
}