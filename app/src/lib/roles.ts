/**
 * Roles & ranks — the single source of truth for the portal's access levels.
 *
 * A member's **role** is authoritative and lives in SuperTokens UserMetadata
 * (set at registration, changeable by admins). Everything else about access is
 * DERIVED from the role via this module, so there is exactly one place that
 * defines the ordering of access levels:
 *
 *   role            rank   sees documents with minRank <=
 *   ------------    ----   ------------------------------
 *   general           1    1
 *   contributor       2    1, 2
 *   super_user    3    1, 2, 3
 *
 * Documents carry a numeric `minRank` (see infra data model); a user may view a
 * document when their rank >= the document's minRank. Storing rank as a number
 * lets the role-based document list be served by the `by-rank` GSI.
 */

export const ROLES = ["general", "contributor", "super_user"] as const;
export type Role = (typeof ROLES)[number];

export type Rank = 1 | 2 | 3;

/** Role → numeric rank. The ONE ordering of access levels. */
const ROLE_TO_RANK: Record<Role, Rank> = {
  general: 1,
  contributor: 2,
  super_user: 3,
};

/** Default role for any user without one explicitly assigned. */
export const DEFAULT_ROLE: Role = "general";

/** Narrow an arbitrary value to a known Role, falling back to the default. */
export function toRole(value: unknown): Role {
  return ROLES.includes(value as Role) ? (value as Role) : DEFAULT_ROLE;
}

/** The numeric rank for a role (defaults applied for unknown input). */
export function rankForRole(value: unknown): Rank {
  return ROLE_TO_RANK[toRole(value)];
}

/** Only committee heads may upload and manage documents. */
export function canManageDocuments(value: unknown): boolean {
  return toRole(value) === "super_user";
}

/**
 * Whether a user of the given role may view a document requiring `minRank`.
 * This is the core RBAC check — call it before serving any document.
 */
export function canViewRank(value: unknown, minRank: number): boolean {
  return rankForRole(value) >= minRank;
}
