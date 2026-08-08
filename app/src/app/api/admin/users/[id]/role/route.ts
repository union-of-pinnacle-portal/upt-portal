import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { rankForRole, toRole, ROLES } from "@/lib/roles";
import UserMetadata from "supertokens-node/recipe/usermetadata";
import supertokens from "supertokens-node";
import { getBackendConfig } from "@/config/supertokens-backend";

supertokens.init(getBackendConfig());

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const currentRank = rankForRole(currentUser.role);
  if (currentRank < 3) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const newRole = toRole(body.role);
  const newRank = rankForRole(newRole);

  if (!ROLES.includes(newRole as (typeof ROLES)[number])) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }

  const targetUser = await supertokens.getUser(id);
  if (!targetUser) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const { metadata: targetMeta } = await UserMetadata.getUserMetadata(id);
  const targetRole = toRole((targetMeta as { role?: string }).role);
  const targetRank = rankForRole(targetRole);
  const targetEmail = targetUser.emails[0] ?? "";
  const isSelf = targetEmail === currentUser.email;

  // Super Users can only be demoted by themselves
  if (targetRank === 4 && !isSelf) {
    return NextResponse.json(
      { error: "Only a Super User can change their own role." },
      { status: 403 },
    );
  }

  // Can only promote up to your own rank
  if (newRank > currentRank) {
    return NextResponse.json(
      { error: "You cannot promote someone above your own role." },
      { status: 403 },
    );
  }

  // Can only demote someone below your rank (unless it's yourself)
  if (targetRank >= currentRank && !isSelf) {
    return NextResponse.json(
      { error: "You cannot change the role of someone at or above your level." },
      { status: 403 },
    );
  }

  await UserMetadata.updateUserMetadata(id, { role: newRole });

  return NextResponse.json({ ok: true, role: newRole });
}
