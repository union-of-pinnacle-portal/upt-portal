import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { rankForRole, toRole } from "@/lib/roles";
import { listRoomsForUser, listRoomMembers } from "@/lib/rooms";
import UserMetadata from "supertokens-node/recipe/usermetadata";
import supertokens from "supertokens-node";
import { getBackendConfig } from "@/config/supertokens-backend";

supertokens.init(getBackendConfig());

export interface UserRow {
  id: string;
  email: string;
  role: string;
  rank: number;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const userRank = rankForRole(user.role);
  if (userRank < 3) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const isSuper = userRank === 4;

  if (isSuper) {
    const count = await supertokens.getUserCount();
    const result = await supertokens.getUsersNewestFirst({
      tenantId: "public",
      limit: Math.min(count, 500),
    });

    const rows: UserRow[] = await Promise.all(
      result.users.map(async (u) => {
        const email = u.emails[0] ?? "";
        const { metadata } = await UserMetadata.getUserMetadata(u.id);
        const role = toRole((metadata as { role?: string }).role);
        return { id: u.id, email, role, rank: rankForRole(role) };
      }),
    );

    return NextResponse.json({ users: rows });
  }

  // Committee Chairs — members of their rooms only
  const rooms = await listRoomsForUser(user.email);
  const emailSet = new Set<string>([user.email]);

  for (const room of rooms) {
    const members = await listRoomMembers(room.roomId);
    for (const m of members) emailSet.add(m.email);
  }

  const rows: UserRow[] = [];
  for (const email of emailSet) {
    try {
      const stResult = await supertokens.listUsersByAccountInfo("public", { email });
      if (!stResult.length) continue;
      const u = stResult[0];
      const { metadata } = await UserMetadata.getUserMetadata(u.id);
      const role = toRole((metadata as { role?: string }).role);
      rows.push({ id: u.id, email, role, rank: rankForRole(role) });
    } catch {
      // skip users that can't be found
    }
  }

  rows.sort((a, b) => a.email.localeCompare(b.email));
  return NextResponse.json({ users: rows });
}
