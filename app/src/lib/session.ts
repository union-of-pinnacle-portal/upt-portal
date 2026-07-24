import "server-only";
import { cookies } from "next/headers";
import supertokens from "supertokens-node";
import { getSSRSession } from "supertokens-node/lib/build/nextjs";
import { getBackendConfig } from "@/config/supertokens-backend";
import { rankForRole, toRole, type Rank, type Role } from "@/lib/roles";

supertokens.init(getBackendConfig());

export interface CurrentUser {
  email: string;
  role: Role;
  rank: Rank;
}

/**
 * Resolve the signed-in user from the SuperTokens session cookie.
 *
 * Reads `role` from the access-token claim (stamped at session creation — see
 * supertokens-backend.ts) and derives `rank` through the single role→rank
 * mapping. Returns null when there is no valid session, so callers decide
 * whether to redirect (pages) or return 401 (route handlers).
 *
 * Works in both Server Components and Route Handlers — both can read cookies().
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const { accessTokenPayload, hasToken, error } = await getSSRSession(
    cookieStore.getAll(),
  );

  if (error || !hasToken || !accessTokenPayload) {
    return null;
  }

  const payload = accessTokenPayload as { role?: unknown; email?: unknown };
  const role = toRole(payload.role);

  return {
    email: typeof payload.email === "string" ? payload.email : "",
    role,
    rank: rankForRole(role),
  };
}
