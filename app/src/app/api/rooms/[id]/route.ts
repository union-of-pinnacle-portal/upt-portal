import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canCreateRooms, deleteRoom, getRoom } from "@/lib/rooms";

/**
 * DELETE /api/rooms/:id
 *
 * Deletes a Committee Room and all its memberships.
 * Super Users only — same gate as creating rooms.
 * Documents in the room become unfiled automatically
 * (their roomId field is not updated here; they show as "Unknown room"
 *  until reassigned, which is acceptable for the delete-room use case).
 */
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

  await deleteRoom(id);
  return NextResponse.json({ ok: true });
}
