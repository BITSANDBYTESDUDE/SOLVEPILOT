/**
 * Search helpers shared by every list endpoint (Task 12).
 *
 * Search terms reach MongoDB as regular expressions, so raw user input must
 * never be used as a pattern: `(`, `*` or `{2,}` typed into a search box would
 * otherwise become operators — at best a syntax error, at worst a pattern that
 * makes the database work far harder than necessary.
 */

/** Characters with a special meaning inside a regular expression. */
const REGEX_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g;

/**
 * Escape a user-supplied string so it matches literally.
 *
 * `escapeRegex("a.b")` produces `a\.b`, which finds "a.b" instead of "axb".
 */
export function escapeRegex(text: string): string {
  return text.replace(REGEX_SPECIAL_CHARACTERS, "\\$&");
}

/**
 * Longest accepted search term.
 *
 * A bound keeps the regular expression engine's work predictable; nobody needs
 * a 10,000-character search string to find a problem.
 */
export const MAX_SEARCH_TERM_LENGTH = 100;

/**
 * Collapse a raw search parameter into a safe term, or `undefined` when there
 * is nothing to search for.
 *
 * Trims, collapses internal whitespace and drops terms that are empty or longer
 * than {@link MAX_SEARCH_TERM_LENGTH}.
 */
export function normalizeSearchTerm(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  const term = value.trim().replace(/\s+/g, " ");
  if (term.length === 0 || term.length > MAX_SEARCH_TERM_LENGTH) return undefined;

  return term;
}

/** Case-insensitive literal substring match, safe for a MongoDB query. */
export function literalRegex(term: string): { $regex: string; $options: "i" } {
  return { $regex: escapeRegex(term), $options: "i" };
}
