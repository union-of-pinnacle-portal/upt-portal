import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import supertokens from "supertokens-node";
import { getSSRSession } from "supertokens-node/lib/build/nextjs";
import UserMetadata from "supertokens-node/recipe/usermetadata";
import { getBackendConfig } from "@/config/supertokens-backend";

supertokens.init(getBackendConfig());

/**
 * GET /api/auth/check-setup
 *
 * Returns whether the current user has completed the setup flow.
 * Used after Google OAuth callback to decide whether to show /auth/setup.
 */
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const cookieList = cookieStore.getAll();

  const { accessTokenPayload, hasToken, error } = await getSSRSession(cookieList);

  if (error || !hasToken || !accessTokenPayload) {
    return NextResponse.json({ setupComplete: false });
  }

  const userId = (accessTokenPayload as { sub?: string }).sub ?? null;
  if (!userId) {
    return NextResponse.json({ setupComplete: false });
  }

  try {
    const { metadata } = await UserMetadata.getUserMetadata(userId);
    return NextResponse.json({
      setupComplete: !!(metadata as { setupComplete?: boolean }).setupComplete,
    });
  } catch {
    return NextResponse.json({ setupComplete: false });
  }
}
