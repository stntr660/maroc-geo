import citiesData from "../data/cities.json" with { type: "json" };
import regionsData from "../data/regions.json" with { type: "json" };
import { normalizeText, score } from "./normalize.js";

/** One of the 12 regions (HCP census code "01" to "12"). */
export interface Region {
  code: string;
  fr: string;
  ar: string;
}

/** A town for address forms: French and Arabic names, HCP region code. */
export interface City {
  id: number;
  fr: string;
  ar: string;
  region: string;
}

export const REGIONS: readonly Region[] = regionsData;
export const CITIES: readonly City[] = citiesData;

/** Names people type that are not in the list, keyed by the list's French name. */
export const CITY_ALIASES: Record<string, string[]> = {
  Casablanca: ["casa", "dar el beida", "darbeida", "dar lbida", "كازا", "البيضاء", "الدار البيضا", "كازابلانكا"],
  Rabat: ["rbat"],
  Mohammedia: ["fdala", "fedala", "mohamadia", "المحمدية", "فضالة"],
  "Ksar El Kebir": ["ksar lkbir", "القصر الكبير"],
  Fes: ["fez", "fass"],
  Tanger: ["tangier", "tangiers", "tanja"],
  Marrakech: ["marrakesh", "marrakch", "mraksh"],
  Meknes: ["miknas"],
  Tetouan: ["tetuan", "tettawen"],
  Kenitra: ["knitra"],
  Laayoune: ["layoune", "el aaiun"],
  Oujda: ["wajda"],
  Sale: ["sla"],
  "El Jadida": ["jadida", "mazagan"],
  "Beni Mellal": ["benimellal"],
};

/** Shown first when nothing is typed: the biggest markets. */
export const MAIN_CITIES = [
  "Casablanca", "Rabat", "Marrakech", "Fes", "Tanger", "Agadir", "Meknes", "Oujda",
  "Kenitra", "Tetouan", "Sale", "Mohammedia", "El Jadida", "Nador", "Beni Mellal", "Safi",
];

const INDEX = CITIES.map((city) => ({
  city,
  keys: [city.fr, city.ar, ...(CITY_ALIASES[city.fr] ?? [])].map(normalizeText).filter(Boolean),
}));

/**
 * Cities matching what someone typed, best first, at most `limit`.
 * Forgives accents, Arabic spelling variants, common nicknames ("casa", "fez")
 * and typos. An empty query lists MAIN_CITIES first, then the rest A to Z.
 */
export function findCities(raw: string, limit = 30): City[] {
  const query = normalizeText(raw);
  if (!query) {
    const main = MAIN_CITIES.map((n) => CITIES.find((c) => c.fr === n)).filter((c): c is City => !!c);
    const rest = CITIES.filter((c) => !main.includes(c)).sort((a, b) => a.fr.localeCompare(b.fr, "fr"));
    return [...main, ...rest].slice(0, limit);
  }
  return INDEX.map((e) => ({ e, best: Math.max(...e.keys.map((k) => score(query, k))) }))
    .filter((r) => r.best > 0)
    .sort((a, b) => b.best - a.best || a.e.city.fr.length - b.e.city.fr.length)
    .slice(0, limit)
    .map((r) => r.e.city);
}

/** Region of a region code, or undefined. */
export const regionByCode = (code: string) => REGIONS.find((r) => r.code === code);
