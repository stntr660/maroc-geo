/**
 * Neighbourhoods (quartiers) of 14 big cities. Separate entry point because the
 * data is about 1 MB: import it on the server, or behind an API route, and send
 * the browser one city at a time.
 *
 * `main` = well-known neighbourhoods, shown when nothing is typed.
 * `all`  = the full cleaned list (includes main), for search.
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

/**
 * Search a neighbourhood list (French, Arabic, aliases, typos). Empty query
 * returns `main`. Works in the browser on the list returned by neighbourhoodsFor.
 */
export function searchNeighbourhoods(list: { main: Neighbourhood[]; all: Neighbourhood[] }, raw: string, limit = 40): Neighbourhood[] {
  const q = normalizeText(raw);
  if (!q) return list.main;
  return list.all
    .map((n) => ({ n, best: Math.max(0, ...[n.fr, n.ar, ...n.aliases].map(normalizeText).filter(Boolean).map((k) => score(q, k))) }))
    .filter((r) => r.best > 0)
    .sort((a, b) => b.best - a.best || a.n.fr.length - b.n.fr.length)
    .slice(0, limit)
    .map((r) => r.n);
}
