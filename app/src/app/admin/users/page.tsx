import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { rankForRole, toRole } from "@/lib/roles";
import { listRoomsForUser, listRoomMembers } from "@/lib/rooms";
import { AppHeader } from "@/components/app-header";
import { BackButton } from "@/components/back-button";
import { UserManagementTable } from "@/components/user-management-table";
import UserMetadata from "supertokens-node/recipe/usermetadata";
import supertokens from "supertokens-node";
import { getBackendConfig } from "@/config/supertokens-backend";
import type { UserRow } from "@/app/api/admin/users/route";

supertokens.init(getBackendConfig());
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const userRank = rankForRole(user.role);
  if (userRank < 3) redirect("/dashboard");

  const isSuper = userRank === 4;
  let users: UserRow[] = [];

  if (isSuper) {
    const count = await supertokens.getUserCount();
    const result = await supertokens.getUsersNewestFirst({
      tenantId: "public",
      limit: Math.min(count, 500),
    });
    users = await Promise.all(
      result.users.map(async (u) => {
        const email = u.emails[0] ?? "";
        const { metadata } = await UserMetadata.getUserMetadata(u.id);
        const role = toRole((metadata as { role?: string }).role);
        return { id: u.id, email, role, rank: rankForRole(role) };
      }),
    );
  } else {
    const rooms = await listRoomsForUser(user.email);
    const emailSet = new Set<string>([user.email]);
    for (const room of rooms) {
      const members = await listRoomMembers(room.roomId);
      for (const m of members) emailSet.add(m.email);
    }
    for (const email of emailSet) {
      try {
        const stResult = await supertokens.listUsersByAccountInfo("public", { email });
        if (!stResult.length) continue;
        const u = stResult[0];
        const { metadata } = await UserMetadata.getUserMetadata(u.id);
        const role = toRole((metadata as { role?: string }).role);
        users.push({ id: u.id, email, role, rank: rankForRole(role) });
      } catch {
        // skip users that can't be found
      }
    }
    users.sort((a, b) => a.email.localeCompare(b.email));
  }

  return (
    <div className="min-h-svh bg-muted/30">
      <AppHeader />
      {/* Width and navigation match /rooms: same shell, same breadcrumb, so
          the admin pages do not feel like a different app. */}
      <main className="mx-auto w-full max-w-[100rem] px-6 py-8 lg:px-10">
        <BackButton href="/dashboard" label="Back to documents" />

        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            Manage members
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSuper
              ? "You can promote or demote any member. Super Users can only be changed by themselves."
              : "You can manage members within your committee rooms."}
          </p>
        </div>

        <UserManagementTable
          users={users}
          currentUserEmail={user.email}
          currentUserRank={userRank}
        />
      </main>
    </div>
  );
}
