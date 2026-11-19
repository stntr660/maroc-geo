/**
 * Text folding for Moroccan place names typed by real people:
 * French with or without accents ("Fès", "fes"), Arabic with or without
 * hamza, taa marbuta or harakat ("فاس", "الدار البيضاء").
 */

/** Arabic letter variants folded to one form, diacritics and tatweel removed. */
export function foldArabic(text: string): string {
  return text
    .replace(/[ً-ٟـٰۖ-ۭ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[ىئ]/g, "ي")
    .replace(/ؤ/g, "و");
}

/**
 * Search key: lowercase, no accents, Arabic folded, and no spaces, dashes or
 * punctuation ("Aïn-Chock" and "ain chock" give the same key).
 */
export function normalizeText(text: string): string {
  return foldArabic(text.normalize("NFD").replace(/[̀-ͯ]/g, ""))
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]/g, "");
}

/** Like normalizeText but keeps single spaces between words (used for exact place lookups). */
export function placeKey(text: string): string {
  return foldArabic(text.normalize("NFD").replace(/[̀-ͯ]/g, ""))
    .toLowerCase()
    .replace(/['`’.,()\-_/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Levenshtein distance, giving up early (returns max + 1) once it exceeds `max`. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, row[j]);
    }
    if (best > max) return max + 1;
    prev = row;
  }
  return prev[b.length];
}

/**
 * How well a normalised query matches a normalised key: 100 exact, 80 prefix,
 * 60 substring, 40 with typos (one slip per four letters typed, at most two:
 * "marakech", "kenitr"), 0 no match.
 */
export function score(query: string, key: string): number {
  if (!query || !key) return 0;
  if (key === query) return 100;
  if (key.startsWith(query)) return 80;
  if (key.includes(query)) return 60;
  const allowed = Math.min(2, Math.floor(query.length / 4));
  if (allowed > 0) {
    if (editDistance(query, key.slice(0, query.length), allowed) <= allowed) return 40;
    if (editDistance(query, key, allowed) <= allowed) return 40;
  }
  return 0;
}
