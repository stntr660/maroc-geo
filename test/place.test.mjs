// Ported from JMLA Pro's tests: every city-list entry lands in its region, common
// spellings land in their province, and the map has the 12 regions (south included).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { placeCity, CITIES, REGIONS, PROVINCES } from "../dist/src/index.js";

const cases = JSON.parse(readFileSync(new URL("./place-cases.json", import.meta.url)));
const topo = JSON.parse(readFileSync(new URL("../data/morocco.topo.json", import.meta.url)));

test("big cities, both scripts, exact region and province", () => {
  for (const [text, region, province] of cases.exact) assert.deepEqual(placeCity(text), { region, province }, text);
});

test("does not guess", () => {
  for (const t of ["xyz", "", null, undefined]) assert.equal(placeCity(t), null);
});

test("how people type towns: each spelling lands in its province", () => {
  const wrong = cases.province.filter(([text, p]) => placeCity(text)?.province !== p);
  assert.deepEqual(wrong, []);
});

test("every city-list entry lands in its own region, by its French and Arabic name", () => {
  const wrong = CITIES.flatMap((c) => [c.fr, c.ar].filter((n) => placeCity(n)?.region !== c.region).map((n) => [n, c.region, placeCity(n)?.region]));
  assert.deepEqual(wrong, []);
});

test("every other city-list entry reaches a province; the region-only list stays honest", () => {
  const missing = CITIES.filter((c) => !cases.regionOnly.includes(c.fr)).flatMap((c) => [c.fr, c.ar]).filter((n) => !placeCity(n)?.province);
  assert.deepEqual(missing, []);
  for (const name of cases.regionOnly) assert.equal(placeCity(name)?.province ?? null, null, name);
});

test("a name two regions share follows the city list (Ajdir → Al Hoceima)", () => {
  assert.equal(placeCity("Ajdir")?.region, "01");
});

test("map file: 12 regions with the south, 75 provinces each in its census region", () => {
  const codes = topo.objects.regions.geometries.map((g) => g.properties.code).sort();
  assert.deepEqual(codes, REGIONS.map((r) => r.code).sort());
  const shapes = topo.objects.provinces.geometries.map((g) => g.properties);
  assert.equal(shapes.length, 75);
  for (const p of PROVINCES) assert.equal(shapes.find((s) => s.code === p.code)?.region, p.region, p.code);
});
