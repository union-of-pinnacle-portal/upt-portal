import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import supertokens from "supertokens-node";
import { getSSRSession } from "supertokens-node/lib/build/nextjs";
import { getBackendConfig } from "@/config/supertokens-backend";

supertokens.init(getBackendConfig());

/**
 * GET /api/auth/session-user-id
 *
 * Returns the current session's userId.
 * Used by the /auth/setup page to identify the user without
 * passing userId through the URL (which would be a security issue).
 */
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const cookieList = cookieStore.getAll();

  const { accessTokenPayload, hasToken, error } = await getSSRSession(cookieList);

  if (error || !hasToken || !accessTokenPayload) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = (accessTokenPayload as { sub?: string }).sub ?? null;

  return NextResponse.json({ userId });
}
