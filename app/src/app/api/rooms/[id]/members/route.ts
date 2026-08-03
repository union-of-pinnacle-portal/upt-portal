import { NextResponse } from "next/server";
import supertokens from "supertokens-node";
import { getCurrentUser } from "@/lib/session";
import {
  addRoomMember,
  canAssignInRoom,
  getRoom,
  removeRoomMember,
} from "@/lib/rooms";

/**
 * Membership management for a Committee Room.
 *
 *   POST   /api/rooms/:id/members   { email }  → add
 *   DELETE /api/rooms/:id/members   { email }  → remove
 *
 * Super Users may manage any room's roster; Committee Chairs only rooms they
 * themselves belong to.
 *
 * SCOPE OF A CHAIR'S POWER: this endpoint grants and revokes *room membership*
 * only — it cannot change anyone's global role. That separation is deliberate.
 * A user's global role fixes their rank, and rank governs what they can read
 * across the entire portal; letting a Chair raise it would let them widen
 * someone's access far outside the room they control. Global role changes stay
 * a Super User action (currently `npm run set-role`).
 */

/** Shared preamble: authenticate, confirm the room exists, authorize. */
async function authorize(roomId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return {
      error: NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 },
      ),
    };
  }

  const room = await getRoom(roomId);
  if (!room) {
    return { error: NextResponse.json({ error: "Not found." }, { status: 404 }) };
  }

  if (!(await canAssignInRoom(user, roomId))) {
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
  }

  return { user };
}

/** Pull and validate the target email from the request body. */
async function readEmail(
  req: Request,
): Promise<{ email: string } | { error: NextResponse }> {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return { error: NextResponse.json({ error: "Invalid JSON." }, { status: 400 }) };
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) {
    return {
      error: NextResponse.json({ error: "email is required." }, { status: 400 }),
    };
  }

  return { email };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const auth = await authorize(id);
  if ("error" in auth) return auth.error;

  const parsed = await readEmail(req);
  if ("error" in parsed) return parsed.error;
  const { email } = parsed;

  // Reject unknown emails rather than storing a membership that will never
  // match anyone. A typo would otherwise fail silently, and the assigner would
  // believe access had been granted.
  const users = await supertokens.listUsersByAccountInfo("public", { email });
  if (!users || users.length === 0) {
    return NextResponse.json(
      { error: "No portal account exists with that email." },
      { status: 400 },
    );
  }

  await addRoomMember(id, email, auth.user.email);

  return NextResponse.json({ email }, { status: 201 });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const auth = await authorize(id);
  if ("error" in auth) return auth.error;

  const parsed = await readEmail(req);
  if ("error" in parsed) return parsed.error;

  await removeRoomMember(id, parsed.email);

  return NextResponse.json({ email: parsed.email });
}
