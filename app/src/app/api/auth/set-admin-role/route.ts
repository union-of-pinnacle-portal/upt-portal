import { NextRequest, NextResponse } from "next/server";
import supertokens from "supertokens-node";
import UserMetadata from "supertokens-node/recipe/usermetadata";
import { getBackendConfig } from "@/config/supertokens-backend";

supertokens.init(getBackendConfig());

/**
 * POST /api/auth/set-admin-role
 *
 * Bootstrap endpoint: if the submitted secret matches ADMIN_BOOTSTRAP_SECRET,
 * sets the user's role to "committee_head".
 *
 * This is only used during initial setup to create the first admin.
 * Once a committee_head exists, role assignment happens through the
 * admin UI instead.
 */
export async function POST(req: NextRequest) {
  const { userId, secret } = await req.json();

  if (!userId || !secret) {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }

  if (secret !== process.env.ADMIN_BOOTSTRAP_SECRET) {
    // Return 200 intentionally — don't reveal whether the secret was wrong
    return NextResponse.json({ status: "ok" });
  }

  await UserMetadata.updateUserMetadata(userId, { role: "committee_head" });

  return NextResponse.json({ status: "ok" });
}
