/**
 * Discretion rule (SPEC §3.1): none of these may appear in any user-facing string,
 * notification, widget, asset name, app/package name or loot caption.
 *
 * Mirrored in SQL as `app.forbidden_words()` / `app.contains_forbidden_word()` —
 * tests/parity.test.ts keeps the two lists identical; tests/discretion.test.ts scans the repo.
 *
 * Matching rule (identical in SQL):
 *   1. normalise: split camelCase ("LockIn" → "Lock In"), strip accents, lowercase;
 *   2. a term must start at a word boundary (so "basement" or "lagoon" never match);
 *   3. the words of a phrase may be joined by nothing or by space . _ - ;
 *   4. anything may follow the start (prefix match), so inflections are caught too.
 */
// The discretion scan skips only text between these markers.
// @forbidden-begin
export const FORBIDDEN_WORDS = [
  'nofap',
  'no fap',
  'fap',
  'porn',
  'masturbat*',
  'semen',
  'retention',
  'nnn',
  'no nut',
  'coom*',
  'goon*',
  'edging',
] as const;
// @forbidden-end

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const PATTERNS: readonly RegExp[] = FORBIDDEN_WORDS.map((term) => {
  const words = term.replace(/\*$/, '').split(' ').map(escapeRegExp);
  return new RegExp(`(^|[^a-z0-9])${words.join('[\\s._-]*')}`);
});

export function normaliseForWordCheck(text: string): string {
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Returns the first forbidden term found, or null. */
export function findForbiddenWord(text: string): string | null {
  const normalised = normaliseForWordCheck(text);
  const index = PATTERNS.findIndex((p) => p.test(normalised));
  return index === -1 ? null : (FORBIDDEN_WORDS[index] ?? null);
}

export function containsForbiddenWord(text: string): boolean {
  return findForbiddenWord(text) !== null;
}
