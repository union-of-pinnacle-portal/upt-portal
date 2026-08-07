/**
 * Which uploaded files can become editable portal documents.
 *
 * Deliberately a plain module — no "use client", no "server-only". The server
 * calls it while rendering the actions column, and the client calls it in the
 * convert flow; exporting it from the client component made it a client
 * reference that the server could not invoke at all.
 */

/**
 * What a document's body actually is.
 *
 *   "file" — an uploaded file (Word, PDF, …). Read by downloading it.
 *   "page" — written in the portal with the built-in editor. Read in the
 *            browser; there is nothing meaningful to download.
 *
 * Everything else about a document — rank visibility, its Committee Room,
 * categories, status, version history — is identical for both.
 */
export type DocumentKind = "file" | "page";

/**
 * A document's kind, defaulting to "file".
 *
 * Documents created before portal authoring existed carry no `kind` at all,
 * and every one of them is an uploaded file — so the absent case and "file"
 * mean the same thing and no migration is needed.
 */
export function documentKind(doc: { kind?: string }): DocumentKind {
  return doc.kind === "page" ? "page" : "file";
}

/**
 * Only Word documents convert. mammoth reads nothing else, and nothing free
 * turns a PDF or spreadsheet into editable rich text without mangling it.
 */
export function isConvertible(filename: string): boolean {
  return filename.toLowerCase().endsWith(".docx");
}
