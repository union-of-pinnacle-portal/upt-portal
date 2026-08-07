/**
 * Shared constants for the documents list filters.
 *
 * A plain module — no "use client", no "server-only" — because the dashboard
 * reads these while rendering on the server and the filter control is a client
 * component. Exporting them from the client component instead would put them
 * behind the client/server boundary.
 */

/**
 * Sentinel for "documents with no room". A real room id is a uuid, so this
 * cannot collide with one.
 */
export const UNFILED = "unfiled";
