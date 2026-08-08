/**
 * Category naming rules, shared by client and server.
 *
 * Categories are user-created (anyone who may upload can add one, see
 * lib/category-store.ts) rather than a code constant, so the guard against a
 * list of near-duplicates is normalization, not a fixed vocabulary:
 * "  meeting   minutes " and "Meeting Minutes" must collapse to one category.
 *
 * This module stays free of AWS imports so the picker component can use the
 * same rules the API enforces — a mismatch there is how a client shows a
 * "create" affordance for a name the server then rejects.
 */

export const MAX_CATEGORY_LENGTH = 60;

/**
 * Clean up a category name for storage and display: trim, collapse internal
 * whitespace. Returns null if the result is empty or too long, which callers
 * turn into a validation error.
 */
export function normalizeCategoryName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name || name.length > MAX_CATEGORY_LENGTH) return null;
  return name;
}

/**
 * The identity of a category — what makes two names "the same" one. Case- and
 * spacing-insensitive, so creating "minutes" when "Minutes" exists reuses the
 * existing category (with its original casing) instead of forking it.
 */
export function categoryKey(name: string): string {
  return name.toLowerCase();
}

/**
 * The categories to display for a document, tolerating pre-multi-category
 * items that carry a single free-text `category` instead. Legacy values are
 * shown verbatim; they become real categories the first time an admin saves
 * the document.
 */
export function documentCategories(doc: {
  categories?: string[];
  category?: string;
}): string[] {
  if (doc.categories?.length) return doc.categories;
  return doc.category ? [doc.category] : [];
}
