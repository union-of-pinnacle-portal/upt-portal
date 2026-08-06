import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canCreateRooms, createRoom } from "@/lib/rooms";

/**
 * POST /api/rooms
 *
 * Create a Committee Room. Super Users only — creating a room is the one
 * action reserved to them by the spec, because a room defines a write scope
 * that Chairs then hand out within.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!canCreateRooms(user.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const name = str(body.name);
  const description = str(body.description);

  if (!name) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }
  if (name.length > 100) {
    return NextResponse.json(
      { error: "name must be 100 characters or fewer." },
      { status: 400 },
    );
  }

  const room = await createRoom({
    id: randomUUID(),
    name,
    description: description || undefined,
    createdBy: user.email,
  });

  return NextResponse.json({ id: room.id }, { status: 201 });
}
