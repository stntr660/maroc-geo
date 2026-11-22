/**
 * Neighbourhoods (quartiers) of 14 big cities. Separate entry point because the
 * data is about 1 MB: import it on the server, or behind an API route, and send
 * the browser one city at a time.
 *
 * `main` = well-known neighbourhoods (every entry with an Arabic name, plus the
 *          delivery zones, arrondissements and other verified ones): show this
 *          list by default, never the full one.
 * `all`  = the full cleaned list (includes main), for search only: it holds
 *          many small lotissements and street-like names a customer would not
 *          recognise when scrolling.
 */
import data from "../data/neighbourhoods.json" with { type: "json" };
import { normalizeText, score } from "./normalize.js";

export interface Neighbourhood {
  fr: string;
  /** Arabic name, empty when no source gives one. */
  ar: string;
  aliases: string[];
}
interface RawNeighbourhood extends Neighbourhood {
  ozon?: boolean;
  src?: string;
}

const CITIES = (data as { cities: Record<string, { main: RawNeighbourhood[]; all: RawNeighbourhood[] }> }).cities;

/** Spellings of the city list (src/cities.ts) that differ from the keys here. */
const KEY: Record<string, string> = {
  Mohammadia: "Mohammedia",
  Fès: "Fes",
  Meknès: "Meknes",
  Salé: "Sale",
  Témara: "Temara",
  Kénitra: "Kenitra",
  Tétouan: "Tetouan",
};

/** City names that have a neighbourhood list. */
export const NEIGHBOURHOOD_CITIES: readonly string[] = Object.keys(CITIES);

const slim = (n: RawNeighbourhood): Neighbourhood => ({ fr: n.fr, ar: n.ar ?? "", aliases: n.aliases ?? [] });

/** Neighbourhoods of a city (French name), or null when the city has no list. */
export function neighbourhoodsFor(city: string): { main: Neighbourhood[]; all: Neighbourhood[] } | null {
  const c = CITIES[city] ?? CITIES[KEY[city] ?? ""];
  if (!c) return null;
  const main = c.main.map(slim);
  const seen = new Set(main.map((n) => n.fr));
  return { main, all: [...main, ...c.all.filter((n) => !seen.has(n.fr)).map(slim)] };
}

/** Well-known neighbourhoods of a city (the default list of a picker), or null when the city has no list. */
export function mainNeighbourhoods(city: string): Neighbourhood[] | null {
  return neighbourhoodsFor(city)?.main ?? null;
}

/**
 * Search a neighbourhood list (French, Arabic, aliases, typos). Under two
 * letters typed it only filters `main` (an empty query returns `main`); from
 * two letters it searches `all`: exact matches, then well-known neighbourhoods,
 * then the rest, typo matches last. Works in the browser on the list returned
 * by neighbourhoodsFor.
 */
export function searchNeighbourhoods(list: { main: Neighbourhood[]; all: Neighbourhood[] }, raw: string, limit = 40): Neighbourhood[] {
  const q = normalizeText(raw);
  if (!q) return list.main;
  const known = new Set(list.main.map((n) => n.fr));
  const rank = (r: { main: boolean; best: number }) => (r.best === 100 ? 3 : r.best >= 60 ? (r.main ? 2 : 1) : 0);
  return (q.length < 2 ? list.main : list.all)
    .map((n) => ({ n, main: known.has(n.fr), best: Math.max(0, ...[n.fr, n.ar, ...n.aliases].map(normalizeText).filter(Boolean).map((k) => score(q, k))) }))
    .filter((r) => r.best > 0)
    .sort((a, b) => rank(b) - rank(a) || b.best - a.best || a.n.fr.length - b.n.fr.length)
    .slice(0, limit)
    .map((r) => r.n);
}
