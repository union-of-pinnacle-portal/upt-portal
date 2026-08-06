import { NextRequest, NextResponse } from "next/server";
import supertokens from "supertokens-node";
import UserMetadata from "supertokens-node/recipe/usermetadata";
import { getBackendConfig } from "@/config/supertokens-backend";

supertokens.init(getBackendConfig());

/**
 * POST /api/auth/set-admin-role
 *
 * Two modes:
 *
 * 1. Bootstrap mode (secret provided):
 *    If secret matches ADMIN_BOOTSTRAP_SECRET, sets role to "committee_head"
 *    and marks setupComplete. Returns { roleAssigned: "committee_head" } on
 *    success so the UI can show a confirmation message.
 *
 * 2. Setup-only mode (markSetupOnly: true):
 *    Just marks setupComplete without changing the role.
 *    Used when the user skips the admin code on /auth/setup.
 *
 * Always returns 200 — never reveal whether the secret was wrong.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userId, secret, markSetupOnly } = body;

  if (!userId) {
    return NextResponse.json({ error: "Missing userId." }, { status: 400 });
  }

  // Setup-only mode — just mark setup as complete
  if (markSetupOnly) {
    await UserMetadata.updateUserMetadata(userId, { setupComplete: true });
    return NextResponse.json({ status: "ok" });
  }

  // Bootstrap mode — check secret and optionally promote
  if (!secret) {
    return NextResponse.json({ status: "ok" });
  }

  if (secret !== process.env.ADMIN_BOOTSTRAP_SECRET) {
    // Wrong code — mark setup complete but don't change role
    await UserMetadata.updateUserMetadata(userId, { setupComplete: true });
    return NextResponse.json({ status: "ok" });
  }

  // Correct code — promote to committee_head and mark setup complete
  await UserMetadata.updateUserMetadata(userId, {
    role: "committee_head",
    setupComplete: true,
  });

  return NextResponse.json({ status: "ok", roleAssigned: "committee_head" });
}
