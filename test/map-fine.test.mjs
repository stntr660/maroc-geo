import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import {
  loadCommunes, loadArrondissements, layoutMorocco, layoutLayer, COMMUNE_MAP_REGIONS,
} from "../dist/src/map.js";

const communes = JSON.parse(readFileSync(new URL("../data/communes.json", import.meta.url), "utf8"));
const hcp = new Map(communes.map((c) => [c.code, c]));

test("fine map: every region file loads, codes are HCP codes, files stay small", async () => {
  assert.equal(COMMUNE_MAP_REGIONS.length, 12);
  const seen = new Set();
  for (const region of COMMUNE_MAP_REGIONS) {
    const size = statSync(new URL(`../data/map/communes-${region}.topo.json`, import.meta.url)).size;
    assert.ok(size < 400 * 1024, `communes-${region} is ${size} bytes`);
    const shapes = await loadCommunes(region);
    assert.ok(shapes.length > 0, region);
    for (const s of shapes) {
      const p = s.properties;
      const c = hcp.get(p.code);
      assert.ok(c, `unknown HCP code ${p.code}`);
      assert.equal(p.region, region);
      assert.equal(p.province, c.province);
      assert.equal(p.fr, c.fr);
      assert.ok(p.ar);
      assert.ok(!seen.has(p.code), `duplicate ${p.code}`);
      seen.add(p.code);
    }
  }
  // 1 503 HCP communes; Sidi Mohamed Benmansour (04.281.05.11) has no boundary in OSM yet.
  assert.ok(seen.size >= 1500, `${seen.size} communes with a shape`);
});

test("fine map: Southern Provinces communes are present (regions 10, 11, 12)", async () => {
  const dakhla = (await loadCommunes("12")).map((s) => s.properties.fr);
  const laayoune = (await loadCommunes("11")).map((s) => s.properties.fr);
  assert.ok(dakhla.includes("Dakhla") && dakhla.includes("Lagouira"));
  assert.ok(laayoune.includes("Laâyoune") || laayoune.some((n) => /^La.youne$/.test(n)), laayoune.join(","));
  assert.ok(laayoune.includes("Boujdour"));
  assert.equal((await loadCommunes("12")).length, communes.filter((c) => c.province.startsWith("12.")).length);
  assert.equal((await loadCommunes("11")).length, communes.filter((c) => c.province.startsWith("11.")).length);
  assert.equal((await loadCommunes("10")).length, communes.filter((c) => c.province.startsWith("10.")).length);
});

test("fine map: arrondissements of the 6 cities, the 16 of Casablanca included", async () => {
  const arr = await loadArrondissements();
  assert.equal(arr.length, 41);
  const casa = arr.filter((a) => a.properties.commune === "06.141.01.0");
  assert.equal(casa.length, 16);
  assert.ok(casa.every((a) => a.properties.city === "Casablanca"));
  assert.ok(casa.some((a) => a.properties.fr === "Anfa"));
  assert.deepEqual(
    [...new Set(arr.map((a) => a.properties.city))].sort(),
    ["Casablanca", "Fès", "Marrakech", "Rabat", "Salé", "Tanger"],
  );
  for (const a of arr) assert.match(a.properties.code, /^\d\d\.\d{3}\.\d\d\.\d\d$/);
});

test("fine map: layers nest on the base projection", async () => {
  const base = layoutMorocco(520, 560, "regions");
  const casaArr = (await loadArrondissements()).filter((a) => a.properties.city === "Casablanca");
  const layer = layoutLayer(base, casaArr);
  assert.equal(layer.path, base.path);
  const [x, y] = base.project(-7.6, 33.57); // central Casablanca
  const [vx, vy, vw, vh] = layer.viewBoxFor().split(" ").map(Number);
  assert.ok(x > vx && x < vx + vw && y > vy && y < vy + vh, "Casablanca centre inside the arrondissements box");
  const anfa = layer.viewBoxFor("06.141.01.01").split(" ").map(Number);
  assert.ok(anfa[2] < vw, "zooming on one arrondissement gives a smaller box");
  assert.ok(layer.path(casaArr[0]).startsWith("M"));
});
