/**
 * Roles & ranks — the single source of truth for the portal's access levels.
 *
 * A member's **role** is authoritative and lives in SuperTokens UserMetadata
 * (set at registration, changeable by admins). Everything else about access is
 * DERIVED from the role via this module, so there is exactly one place that
 * defines the ordering of access levels:
 *
 *   role             rank   display name       sees documents with minRank <=
 *   --------------   ----   ----------------   ------------------------------
 *   general            1    General Member     1
 *   contributor        2    Committee Member   1, 2
 *   committee_chair    3    Committee Chair    1, 2, 3
 *   committee_head     4    Super User         1, 2, 3, 4
 *
 * Documents carry a numeric `minRank` (see infra data model); a user may view a
 * document when their rank >= the document's minRank. Storing rank as a number
 * lets the role-based document list be served by the `by-rank` GSI.
 *
 * NOTE ON NAMING: the stored role strings are deliberately unchanged from the
 * portal's first release even though two display names moved — `contributor` is
 * now shown as "Committee Member" and `committee_head` as "Super User". The
 * strings are persisted in SuperTokens UserMetadata, so renaming them would
 * require migrating every live user record for no functional gain. Display
 * names live in ROLE_LABEL below; treat the strings as opaque ids.
 *
 * Read access is global and rank-based (this module). Write access will be
 * scoped to a user's assigned Committee Room — see `canWriteInRoom` in
 * lib/rooms.ts.
 */

export const ROLES = [
  "general",
  "contributor",
  "committee_chair",
  "committee_head",
] as const;
export type Role = (typeof ROLES)[number];

export type Rank = 1 | 2 | 3 | 4;

/** Every rank, ascending. Derived from — and kept in step with — ROLE_TO_RANK. */
export const RANKS: readonly Rank[] = [1, 2, 3, 4];

/** Role → numeric rank. The ONE ordering of access levels. */
const ROLE_TO_RANK: Record<Role, Rank> = {
  general: 1,
  contributor: 2,
  committee_chair: 3,
  committee_head: 4,
};

/** Human-readable role names, for any UI that shows a role to a member. */
export const ROLE_LABEL: Record<Role, string> = {
  general: "General Member",
  contributor: "Committee Member",
  committee_chair: "Committee Chair",
  committee_head: "Super User",
};

/**
 * The "Who can view" choices, ascending by restrictiveness. Both the upload and
 * edit forms render this list, so a new access level needs no UI change.
 */
export const MIN_RANK_OPTIONS: readonly { value: Rank; label: string }[] = [
  { value: 1, label: "All members (general and up)" },
  { value: 2, label: "Committee members and up" },
  { value: 3, label: "Committee chairs and up" },
  { value: 4, label: "Super users only" },
];

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

/**
 * Whether an arbitrary value is a valid rank. Route handlers validate a
 * client-supplied `minRank` through this, so adding a level never leaves a
 * stale `1 | 2 | 3` check behind.
 */
export function isRank(value: unknown): value is Rank {
  return RANKS.includes(value as Rank);
}

/**
 * NOTE: there is deliberately no write-permission helper in this module.
 * Write access is scoped to a Committee Room and requires a membership lookup,
 * so it cannot be decided from a role alone — see `canWriteInRoom` in
 * lib/rooms.ts. This module stays pure and synchronous (it is imported by
 * client components); anything needing I/O belongs in lib/rooms.ts.
 */

/**
 * Whether a user of the given role may view a document requiring `minRank`.
 * This is the core RBAC check — call it before serving any document.
 */
export function canViewRank(value: unknown, minRank: number): boolean {
  return rankForRole(value) >= minRank;
}
