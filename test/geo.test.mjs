import { test } from "node:test";
import assert from "node:assert/strict";
import { findCities, placeCity, placeRegion, normalizeText, REGIONS, CITIES, PROVINCES, COMMUNES, aggregateByPlace } from "../dist/src/index.js";
import { neighbourhoodsFor, mainNeighbourhoods, searchNeighbourhoods, NEIGHBOURHOOD_CITIES } from "../dist/src/neighbourhoods.js";
import { layoutMorocco, moroccoShapes, CITY_POINTS } from "../dist/src/map.js";

test("data sizes", () => {
  assert.equal(REGIONS.length, 12);
  assert.equal(PROVINCES.length, 75);
  assert.ok(COMMUNES.length > 1500);
  assert.equal(CITIES.length, 391);
  assert.equal(CITY_POINTS.length, 180);
  assert.equal(NEIGHBOURHOOD_CITIES.length, 14);
});

test("every city points to a real region", () => {
  const codes = new Set(REGIONS.map((r) => r.code));
  for (const c of CITIES) assert.ok(codes.has(c.region), c.fr);
});

test("normalizeText folds accents and Arabic variants", () => {
  assert.equal(normalizeText("Aïn-Chock"), normalizeText("ain chock"));
  assert.equal(normalizeText("مدينة"), normalizeText("مدينه"));
});

test("findCities forgives nicknames, Arabic and typos", () => {
  assert.equal(findCities("casa")[0].fr, "Casablanca");
  assert.equal(findCities("fez")[0].fr, "Fes");
  assert.equal(findCities("marakech")[0].fr, "Marrakech");
  assert.equal(findCities("طنجة")[0].fr, "Tanger");
  assert.equal(findCities("")[0].fr, "Casablanca");
});

test("placeCity gives HCP region and province", () => {
  assert.equal(placeCity("Casablanca").region, "06");
  assert.equal(placeCity("fes").region, "03");
  assert.equal(placeCity("فاس").region, "03");
  assert.equal(placeCity("Laayoune").region, "11");
  assert.equal(placeCity("Atlantis"), null);
  assert.equal(placeRegion("Marrakesh-Safi"), "07");
  assert.equal(placeRegion("الشرق"), "02");
});

test("aggregateByPlace counts unplaced rows", () => {
  const r = aggregateByPlace([{ city: "Rabat", values: { n: 2 } }, { city: "???", values: { n: 1 } }], ["n"]);
  assert.equal(r.regions["04"].n, 2);
  assert.equal(r.unplaced.n, 1);
});

test("neighbourhoods: list and search", () => {
  const casa = neighbourhoodsFor("Casablanca");
  assert.ok(casa.main.length >= 40 && casa.all.length > 1000);
  assert.equal(searchNeighbourhoods(casa, "maarif")[0].fr, "Maârif");
  assert.equal(searchNeighbourhoods(casa, "").length, casa.main.length);
  // default list = well-known quartiers only, every entry with an Arabic name is in it
  assert.ok(casa.main.length < 120);
  assert.ok(casa.main.some((n) => n.fr === "Nassim" && n.ar === "النسيم"));
  assert.ok(!casa.main.some((n) => n.fr === "Abdelhay"));
  assert.deepEqual(mainNeighbourhoods("Casablanca"), casa.main);
  for (const c of NEIGHBOURHOOD_CITIES) {
    const l = neighbourhoodsFor(c);
    const known = new Set(l.main.map((n) => n.fr));
    assert.ok(l.all.every((n) => !n.ar || known.has(n.fr) || n.fr === "El Faïd"), c);
  }
  // one letter only filters main; two letters search everything, well-known first
  assert.ok(searchNeighbourhoods(casa, "a").every((n) => casa.main.includes(n)));
  assert.equal(searchNeighbourhoods(casa, "abdelhay")[0].fr, "Abdelhay");
  assert.equal(searchNeighbourhoods(casa, "النسيم")[0].fr, "Nassim");
  assert.ok(neighbourhoodsFor("Mohammadia"));
  assert.equal(neighbourhoodsFor("Ouarzazate"), null);
});

test("map: 12 regions, 75 provinces, cities projected inside the frame", () => {
  assert.equal(moroccoShapes("regions").length, 12);
  assert.equal(moroccoShapes("provinces").length, 75);
  const m = layoutMorocco(520, 560);
  const [x, y] = m.project(-7.61, 33.59);
  assert.ok(x > 0 && x < 520 && y > 0 && y < 560);
  assert.ok(m.borders.length > 100);
  assert.notEqual(m.viewBoxFor("06"), "0 0 520 560");
});
