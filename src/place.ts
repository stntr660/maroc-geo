/**
 * Where in Morocco a free-text city is: its HCP region and province.
 *
 * Order and client cities are free text, typed in French or Arabic, with or
 * without accents ("Fès", "فاس", "fes"). placeCity turns one into census codes
 * a map can count. It never guesses: a text that matches no commune, province,
 * city-list entry or known alias returns null.
 *
 * Codes are the HCP census ones: region "06", province "06.141". Casablanca's
 * 8 préfectures d'arrondissements roll up into 06.141.
 *
 * How a typed city is placed (see docs/PLACE-CITY.md):
 *  1. key: accents dropped, Arabic normalised, punctuation to spaces;
 *  2. alias: a known spelling is replaced by the census name of the SAME place;
 *  3. census: province names first, then communes biggest first;
 *  4. city-list priority: when the key is in data/cities.json, its region settles
 *     a name two regions share, and a census match in another region is refused;
 *  5. close spelling (1-2 letters) inside that region only, then the entry's
 *     name in the other script, exactly;
 *  6. a city-list entry still unmatched is placed in its region, province null;
 *  7. anything else: null.
 */
import communesData from "../data/communes.json" with { type: "json" };
import provincesData from "../data/provinces.json" with { type: "json" };
import regionsData from "../data/regions.json" with { type: "json" };
import citiesData from "../data/cities.json" with { type: "json" };
import { editDistance, placeKey } from "./normalize.js";

export interface Province {
  code: string;
  region: string;
  fr: string;
  ar: string;
}
export interface Commune {
  code: string;
  province: string;
  fr: string;
  ar: string;
  population2024: number;
}
export interface PlacedLocation {
  region: string;
  /** Null when only the region is known (a city-list entry with no census commune). */
  province: string | null;
}

export const PROVINCES: readonly Province[] = provincesData;
export const COMMUNES: readonly Commune[] = communesData;

/** Names people type that are not the census spelling. Each points at the HCP name of the SAME place. */
export const PLACE_ALIASES = new Map(
  Object.entries({
    casa: "Casablanca",
    "dar el beida": "Casablanca",
    "dar bida": "Casablanca",
    "الدار البيضاء": "Casablanca",
    "الدارالبيضاء": "Casablanca",
    "البيضاء": "Casablanca",
    tangier: "Tanger",
    tangiers: "Tanger",
    tanja: "Tanger",
    fez: "Fès",
    marrakesh: "Marrakech",
    laayoune: "Laâyoune",
    smara: "Es-Semara",
    semara: "Es-Semara",
    "السمارة": "Es-Semara",
    layoune: "Laâyoune",
    "el aaiun": "Laâyoune",

    // Common French spellings the census writes another way. Each one points
    // at the HCP name of the same town, so it can only ever land where that
    // town is (tests/unit/morocco-admin.test.ts runs the whole list).
    taroudant: "Taroudannt",
    erfoud: "Arfoud",
    mrirt: "M'rirt",
    "kelaa des sraghna": "Kelâat Sraghna",
    "kelaa sraghna": "Kelâat Sraghna",
    "kalaat sraghna": "Kelâat Sraghna",
    "kalaa sraghna": "Kelâat Sraghna",
    "kelaat es sraghna": "Kelâat Sraghna",
    tantan: "Tan-Tan",
    chaouen: "Chefchaouen",
    chefchaouene: "Chefchaouen",
    hoceima: "Al Hoceima",
    alhoceima: "Al Hoceima",
    "el hoceima": "Al Hoceima",
    tetuan: "Tétouan",
    tetouane: "Tétouan",
    mohammedia: "Mohammadia",
    mohamedia: "Mohammadia",
    "ben slimane": "Benslimane",
    skhirat: "Skhirate",
    "souk larbaa": "Souk El Arbaa",
    "souk larbaa el gharb": "Souk El Arbaa",
    "souk el arbaa du gharb": "Souk El Arbaa",
    asilah: "Assilah",
    arzila: "Assilah",
    mdiq: "M'diq",
    rachidia: "Errachidia",
    "er rachidia": "Errachidia",
    "ksar es souk": "Errachidia",
    tinerhir: "Tinghir",
    tineghir: "Tinghir",
    "fkih ben salah": "Fquih Ben Salah",
    "fkih bensalah": "Fquih Ben Salah",
    "fqih ben salah": "Fquih Ben Salah",
    "fquih bensalah": "Fquih Ben Salah",
    benguerir: "Ben Guerir",
    "ouled teima": "Oulad Teima",
    boujad: "Bejaad",
    boujaad: "Bejaad",
    "souk sebt": "Souk Sebt Ouled Nemma",
    "souk sebt oulad nemma": "Souk Sebt Ouled Nemma",
    "sidi yahya el gharb": "Sidi Yahia El Gharb",
    "sidi yahya gharb": "Sidi Yahia El Gharb",
    tahanaout: "Tahannaout",
    "kelaat mgouna": "Kalâat M'gouna",
    "kalaat mgouna": "Kalâat M'gouna",
    "qalaat mgouna": "Kalâat M'gouna",
    "el kelaa mgouna": "Kalâat M'gouna",
    tazenakht: "Taznakht",
    mhamid: "M'hamid El Ghizlane",
    "m hamid": "M'hamid El Ghizlane",
    "ribat el kheir": "Ribate El Kheir",
    drarga: "Drargua",
    "sidi allal bahraoui": "Sidi Allal El Bahraoui",
    "beni ansar": "Bni Ansar",
    "beni enzar": "Bni Ansar",
    "el aioun sidi mellouk": "El Aioun Sidi Mellouk",
    "laayoune sidi mellouk": "El Aioun Sidi Mellouk",
    goulimine: "Guelmim",
    guelmime: "Guelmim",
    jadida: "El Jadida",
    "es semara": "Es-Semara",
    essmara: "Es-Semara",
    "bni mellal": "Béni Mellal",
    "kasbah tadla": "Kasba Tadla",
    zemamra: "Zmamra",
    oualidia: "Loualidia",
    "ksar kebir": "Ksar El Kebir",
    "ksar el kbir": "Ksar El Kebir",
    "ksar lekbir": "Ksar El Kebir",

    // Towns the city picker lists that the census names after their commune;
    // the picker knew only the region, these give the province too (same region).
    rissani: "Er-Rissani",
    skoura: "Skoura Ahl El Oust",
    tamesna: "Sidi Yahya Zaer",
    "تامسنا": "Sidi Yahya Zaer",
    tamansourt: "Harbil",
    "تامنصورت": "Harbil",
    "moulay idriss zerhoun": "My Idriss Zerhoun",
    "سيدي بوقنادل": "Sidi Bouknadel",
    "sebt jahjouh": "Jahjouh",
    "سبت جحجوح": "Jahjouh",
    "khemis zemamra": "Zmamra",
    "خميس الزمامرة": "Zmamra",
    "oulad h riz sahel": "Sahel Oulad H'riz",
    "أولاد حريز الساحل": "Sahel Oulad H'riz",
    awsard: "Aousserd",
    "ras el ain": "Ras El Ain Chaouia",
    "رأس العين": "Ras El Ain Chaouia",
    "kariat arekmane": "Arekmane",
    "قرية أركمان": "Arekmane",

    // Picker places the census has no commune for (a douar, a beach, a port,
    // a district of a town): the province they are in, by its HCP name.
    akchour: "Chefchaouen",
    "أكشور": "Chefchaouen",
    jebha: "Chefchaouen",
    "جبهة": "Chefchaouen",
    "khemis sahel": "Larache",
    "خميس الساحل": "Larache",
    "amalou ighriben": "Khénifra",
    "أمالو إغريبن": "Khénifra",
    "kehf nsour": "Khénifra",
    "كهف النسور": "Khénifra",
    tighza: "Khénifra",
    "تيغزة": "Khénifra",
    "jorf lasfar": "El Jadida",
    "الجرف الأصفر": "El Jadida",
    "sidi bouzid": "El Jadida",
    "سيدي بوزيد": "El Jadida",
    "ben sergao": "Agadir-Ida-Ou-Tanane",
    "بن سركاو": "Agadir-Ida-Ou-Tanane",
    kassita: "Driouch",
    "قاسيطة": "Driouch",
    "zaouia d ifrane": "Ifrane",
    "زاوية إفران": "Ifrane",
    "ait attab": "Azilal",
    "أيت عتاب": "Azilal",
    mzouda: "Chichaoua",
    "مزودة": "Chichaoua",
    "لالة تاكركوست": "Lalla Takarkoust",
    "استحات": "Steha",
    // These two used to land, one or two letters off, on an unrelated commune
    // of the same region (Driouch, Chefchaouen).
    farkhana: "Nador",
    "فرخانة": "Nador",
    tamassint: "Al Hoceima",
    "تماسينت": "Al Hoceima",
    // Arabic spellings that landed on a neighbour commune while the French
    // name of the same picker entry is the census one.
    "عين الشقاق": "Ain Cheggag",
    "تاينست": "Tainaste",
    "توارقة": "Touarga",
    // Tamraght is in Aourir (Agadir); "تمراغت" used to land, one letter off, in Tata.
    tamraght: "Aourir",
    "تمراغت": "Aourir",
  }).map(([typed, census]) => [placeKey(typed), census])
);

const PROVINCE_BY_CODE = new Map(PROVINCES.map((p) => [p.code, p]));

/** "06.141.01.20" is inside "06.141". */
const shapedProvince = (code: string) => code.split(".").slice(0, 2).join(".");

/** Every place a key can name, provinces first, then communes biggest first. */
const INDEX: Map<string, PlacedLocation[]> = (() => {
  const index = new Map<string, PlacedLocation[]>();
  const put = (name: string, loc: PlacedLocation) => {
    const key = placeKey(name);
    if (!key) return;
    const list = index.get(key) ?? [];
    if (!list.some((l) => l.province === loc.province)) list.push(loc);
    index.set(key, list);
  };
  for (const p of PROVINCES) {
    const province = shapedProvince(p.code);
    put(p.fr, { region: p.region, province });
    put(p.ar, { region: p.region, province });
  }
  for (const c of [...COMMUNES].sort((a, b) => b.population2024 - a.population2024)) {
    const province = shapedProvince(c.province);
    const region = PROVINCE_BY_CODE.get(province)?.region;
    if (!region) continue;
    put(c.fr, { region, province });
    put(c.ar, { region, province });
  }
  return index;
})();

/** The city list (data/cities.json): region only, but it is what users pick from. */
const LIST_REGION = new Map<string, string>();
/** A city-list entry's name in the other script ("Irherm" <-> "إرحرم"). */
const LIST_SIBLING = new Map<string, string>();
for (const c of citiesData) {
  const fr = placeKey(c.fr);
  const ar = placeKey(c.ar);
  LIST_REGION.set(fr, c.region);
  LIST_REGION.set(ar, c.region);
  if (fr && ar && fr !== ar) {
    if (!LIST_SIBLING.has(fr)) LIST_SIBLING.set(fr, ar);
    if (!LIST_SIBLING.has(ar)) LIST_SIBLING.set(ar, fr);
  }
}

/** Region and province of a typed city, or null when it cannot be placed. Pure and synchronous. */
export function placeCity(text: string | null | undefined): PlacedLocation | null {
  if (!text) return null;
  const typed = placeKey(text);
  if (!typed) return null;
  const key = placeKey(PLACE_ALIASES.get(typed) ?? typed);
  const listRegion = LIST_REGION.get(key);
  const candidates = INDEX.get(key) ?? [];
  const match = candidates.find((c) => c.region === listRegion) ?? candidates[0];
  if (match && (!listRegion || match.region === listRegion)) return match;
  if (!listRegion) return null;
  return nearInRegion(key, listRegion) ?? inRegionBySibling(key, listRegion) ?? { region: listRegion, province: null };
}

function inRegionBySibling(key: string, region: string): PlacedLocation | null {
  const sibling = LIST_SIBLING.get(key);
  if (!sibling) return null;
  return (INDEX.get(placeKey(PLACE_ALIASES.get(sibling) ?? sibling)) ?? []).find((c) => c.region === region) ?? null;
}

const KEYS_BY_REGION = new Map<string, Array<[string, PlacedLocation]>>();
for (const [key, list] of INDEX) {
  for (const loc of list) {
    const bucket = KEYS_BY_REGION.get(loc.region) ?? [];
    bucket.push([key, loc]);
    KEYS_BY_REGION.set(loc.region, bucket);
  }
}
const nearCache = new Map<string, PlacedLocation | null>();

/** One or two letters off, only inside a region already known, so it never moves a place to another region. */
function nearInRegion(key: string, region: string): PlacedLocation | null {
  const cacheKey = `${region}:${key}`;
  if (nearCache.has(cacheKey)) return nearCache.get(cacheKey)!;
  const budget = key.length >= 6 ? 2 : 1;
  let best: PlacedLocation | null = null;
  let bestDistance = budget + 1;
  for (const [candidate, loc] of KEYS_BY_REGION.get(region) ?? []) {
    if (Math.abs(candidate.length - key.length) > budget) continue;
    const d = editDistance(key, candidate, budget);
    if (d < bestDistance) {
      best = loc;
      bestDistance = d;
    }
  }
  nearCache.set(cacheKey, best);
  return best;
}

const REGION_INDEX = new Map<string, string>([
  ...regionsData.flatMap((r) => [[placeKey(r.fr), r.code], [placeKey(r.ar), r.code]] as Array<[string, string]>),
  ...Object.entries({
    "marrakesh safi": "07",
    "tangier tetouan al hoceima": "01",
    "tanger tetouan al hoceima": "01",
    eastern: "02",
    oriental: "02",
    "l oriental": "02",
    "fes meknes": "03",
    "rabat sale kenitra": "04",
    "beni mellal khenifra": "05",
    "casablanca settat": "06",
    "draa tafilalet": "08",
    "souss massa": "09",
    "guelmim oued noun": "10",
    "laayoune sakia el hamra": "11",
    "dakhla oued ed dahab": "12",
  }).map(([typed, code]) => [placeKey(typed), code] as [string, string]),
]);

/** HCP region code of a region name ("Casablanca-Settat", "Marrakesh-Safi", "الشرق"), or null. */
export function placeRegion(text: string | null | undefined): string | null {
  if (!text) return null;
  return REGION_INDEX.get(placeKey(text)) ?? null;
}

/**
 * Sums rows by region and province for a map. `unplaced` holds what no city
 * could be found for, so the UI can say how much the map is missing.
 * Rows placed to a region only count in `regions`, not in `provinces`.
 */
export function aggregateByPlace<M extends string>(
  rows: Array<{ city: string | null | undefined; values: Record<M, number> }>,
  metrics: readonly M[],
) {
  const zero = () => Object.fromEntries(metrics.map((m) => [m, 0])) as Record<M, number>;
  const regions: Record<string, Record<M, number>> = {};
  const provinces: Record<string, Record<M, number>> = {};
  const unplaced = zero();
  const add = (bag: Record<M, number>, values: Record<M, number>) => {
    for (const m of metrics) bag[m] += values[m] ?? 0;
  };
  for (const row of rows) {
    const place = placeCity(row.city);
    if (!place) {
      add(unplaced, row.values);
      continue;
    }
    add((regions[place.region] ??= zero()), row.values);
    if (place.province) add((provinces[place.province] ??= zero()), row.values);
  }
  return { regions, provinces, unplaced };
}
