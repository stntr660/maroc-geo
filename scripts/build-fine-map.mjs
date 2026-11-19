#!/usr/bin/env node
/**
 * Step 2 of the fine map build: match the OSM boundaries extracted by
 * scripts/build-fine-map.py to HCP codes, simplify, and write
 *
 *   data/map/communes-<region>.topo.json   one file per region (12), object "communes",
 *                                          properties { code, province, region, fr, ar }
 *   data/map/arrondissements.topo.json     object "arrondissements",
 *                                          properties { code, commune, city, fr, ar }
 *   data/map/match-report.json             what matched how, and what did not
 *
 * Sources
 *   Geometry: OpenStreetMap, Geofabrik extract
 *     https://download.geofabrik.de/africa/morocco-latest.osm.pbf
 *     (ODbL 1.0, (c) OpenStreetMap contributors). The extract covers the whole
 *     Kingdom, Southern Provinces included.
 *   Codes and names: HCP RGPH 2024 via morocco-communes@1.9.1 (data CC BY 4.0,
 *     credit the Haut-Commissariat au Plan) -> data/communes.json in this repo
 *     and dist/arrondissements.js in the npm package
 *     (npm pack morocco-communes@1.9.1 && tar -xzf morocco-communes-1.9.1.tgz).
 *
 * Matching, in order (never fuzzy):
 *   1. "ref"      OSM ref:MA:HCP (trailing dot removed) equals an HCP code and the
 *                 normalised French or Arabic names agree (equal, one containing
 *                 the other, or listed in ALIASES).
 *   1b. "alias"   ref equals an HCP code and the OSM name is the hand-checked
 *                 spelling listed in ALIAS_BY_CODE.
 *   2. "name"     same normalised name (or alias) as an HCP commune of the
 *                 province the shape's interior point falls in, used when the
 *                 ref is missing or points to a commune with another name.
 *   3. "ref-only" ref equals an HCP code but the names disagree and no name
 *                 match exists: kept, and listed in the report for review.
 *   Everything else is listed as unmatched in the report.
 *
 * Usage
 *   python3 scripts/build-fine-map.py morocco-latest.osm.pbf /tmp/admin.geojson
 *   node scripts/build-fine-map.mjs /tmp/admin.geojson <morocco-communes package dir>
 *
 * Needs `npx -y mapshaper@0.7` (fetched on demand, not a dependency).
 */
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { geoContains } from "d3-geo"
import { feature } from "topojson-client"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const [adminPath, communesPkg, outArg] = process.argv.slice(2)
if (!adminPath || !communesPkg) {
  console.error("usage: build-fine-map.mjs <admin.geojson> <morocco-communes pkg dir> [out dir]")
  process.exit(1)
}
const OUT = resolve(outArg ?? join(ROOT, "data/map"))
mkdirSync(OUT, { recursive: true })

// ---------- HCP side ----------
const COMMUNES = JSON.parse(readFileSync(join(ROOT, "data/communes.json"), "utf8"))
const ARRS = (await import(pathToFileURL(resolve(communesPkg, "dist/arrondissements.js")).href)).default
const hcpCommune = new Map(COMMUNES.map((c) => [c.code, c]))
const hcpArr = new Map(ARRS.map((a) => [a.code, a]))

// ---------- name normalisation ----------
const foldAr = (s) =>
  s.replace(/[ً-ٟـٰ]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/[ىئ]/g, "ي").replace(/ؤ/g, "و").replace(/[گ]/g, "ك")
const PREFIX_FR =
  /^(arrondissement|commune|municipalite|caidat|prefecture d'arrondissements?)( (urbaine|rurale|territoriale))?( (de la|de l'|des|du|de|d'|d))?\s*/
const PREFIX_AR = /^(مقاطعه|جماعه|الجماعه|بلديه|الجماعه الترابيه|جماعه ترابيه)\s+/
const keyFr = (s) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ⴰ-⵿]/g, " ") // Tifinagh
    .replace(/[؀-ۿ]/g, " ") // Arabic
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .trim()
    .replace(PREFIX_FR, "")
    .replace(/['\-_.,()/]/g, " ")
    .replace(/\b(el|al|ait|ait|ouled|oulad|ouled|bni|beni|sidi|sid|ain|my|moulay)\b/g, (w) =>
      ({ al: "el", ouled: "oulad", bni: "beni", sid: "sidi", my: "moulay" })[w] ?? w,
    )
    .replace(/\s+/g, "")
const keyAr = (s) => {
  const ar = foldAr((s ?? "").replace(/[^؀-ۿ\s]/g, " ").replace(/\s+/g, " ").trim())
  return ar.replace(PREFIX_AR, "").replace(/\s+/g, "")
}

// OSM spelling -> HCP spelling, both after keyFr(). Only add pairs checked by hand.
const ALIASES = {}
// HCP code -> OSM French name, for shapes whose ref:MA:HCP is right but whose
// name is spelt differently. Each pair was checked by hand (same ref, same
// province, same place); the shape is then counted as "alias", not "ref".
const ALIAS_BY_CODE = {
  "02.113.01.05": "Aïn Reggada", // Ain Erreggada
  "03.531.05.05": "Ghouazi", // Rhouazi
  "04.291.03.09": "El Kansera", // El Ganzra (OSM name:fr, name:ar القنصرة)
  "03.271.03.11": "Timhadit", // Timahdite
  "05.255.11.01": "Dar Oulad Zidouh", // Dar Ould Zidouh
  "03.451.01.07": "Ahermoumou", // renamed Ribate El Kheir
  "03.561.01.05": "Oued Amlil", // Ouad Amlil
  "06.355.01.07": "El Majjatia Ouled Taleb", // Almajjatia Oulad Taleb
  "09.163.07.23": "Ouad Essafa", // Oued Essafa
  "01.051.07.07": "Beni Bechir", // Bni Bchir
  "01.151.03.13": "Younane", // Iounane
  "01.571.03.01": "Aïn Lahcen", // Ain Lahsan
  "08.363.05.21": "Sidi Yahya Ou Youssef", // Sidi Yahia Ou Youssef
  "02.533.09.11": "Melga el Ouidane", // Melg El Ouidane
}

function namesAgree(osm, hcp) {
  const f1 = osm.fr, f2 = keyFr(hcp.fr)
  const a1 = osm.ar, a2 = keyAr(hcp.ar)
  if (f1 && f2 && (f1 === f2 || ALIASES[f1] === f2)) return true
  if (a1 && a2 && a1 === a2) return true
  if (f1 && f2 && f1.length >= 4 && f2.length >= 4 && (f1.includes(f2) || f2.includes(f1))) return true
  if (a1 && a2 && a1.length >= 3 && a2.length >= 3 && (a1.includes(a2) || a2.includes(a1))) return true
  return false
}

// ---------- OSM side ----------
const admin = JSON.parse(readFileSync(adminPath, "utf8"))
const provTopo = JSON.parse(readFileSync(join(ROOT, "data/morocco.topo.json"), "utf8"))
const provShapes = feature(provTopo, provTopo.objects.provinces).features
const regionShapes = feature(provTopo, provTopo.objects.regions).features

// A point well inside the shape (planar, winding-agnostic): on a 24x24 grid
// over the largest polygon, the inside point farthest from its vertices.
const ringArea = (ring) => {
  let a = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1])
  return Math.abs(a / 2)
}
const inRing = ([x, y], ring) => {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
const inPoly = (pt, poly) => inRing(pt, poly[0]) && !poly.slice(1).some((h) => inRing(pt, h))
function interiorPoint(geom) {
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates
  const best = polys.reduce((m, p) => (ringArea(p[0]) > ringArea(m[0]) ? p : m))
  const xs = best[0].map((v) => v[0]), ys = best[0].map((v) => v[1])
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const verts = best.flat()
  const step = Math.max(1, Math.floor(verts.length / 400))
  let pick = best[0][0], far = -1
  for (let i = 1; i < 24; i++)
    for (let j = 1; j < 24; j++) {
      const pt = [x0 + ((x1 - x0) * i) / 24, y0 + ((y1 - y0) * j) / 24]
      if (!inPoly(pt, best)) continue
      let d = Infinity
      for (let k = 0; k < verts.length; k += step) d = Math.min(d, (verts[k][0] - pt[0]) ** 2 + (verts[k][1] - pt[1]) ** 2)
      if (d > far) (far = d), (pick = pt)
    }
  return pick
}
const provinceAt = (pt) => provShapes.find((s) => geoContains(s, pt))?.properties.code ?? null
const regionAt = (pt) => regionShapes.find((s) => geoContains(s, pt))?.properties.code ?? null

const normRef = (r) => (r ?? "").trim().replace(/\.+$/, "")
function osmRecord(f) {
  const t = f.properties
  const frRaw = t["name:fr"] || t.name || ""
  const pt = interiorPoint(f.geometry)
  return {
    f,
    id: t.osm_id,
    level: t.admin_level,
    ref: normRef(t["ref:MA:HCP"]),
    rawName: t.name,
    fr: keyFr(frRaw),
    ar: keyAr(t["name:ar"] || t.name),
    pt,
    province: provinceAt(pt),
  }
}

// Inside Morocco = tagged with an HCP code, or interior point inside one of the
// 75 province shapes (this drops Ceuta, Melilla, the Canaries and Algeria).
const level = (n) =>
  admin.features.filter((f) => f.properties.admin_level === n).map(osmRecord).filter((r) => r.province || r.ref)

function matchLayer(osmList, hcpMap, hcpProvinceOf, label) {
  const claimed = new Map() // hcp code -> [osm records]
  const how = new Map() // osm id -> {code, how}
  const claim = (r, code, kind) => {
    how.set(r.id, { code, how: kind })
    if (!claimed.has(code)) claimed.set(code, [])
    claimed.get(code).push(r)
  }
  // index HCP by province + names
  const byProv = new Map()
  for (const h of hcpMap.values()) {
    const p = hcpProvinceOf(h)
    if (!byProv.has(p)) byProv.set(p, [])
    byProv.get(p).push(h)
  }
  const nameMatches = (r) => {
    const pool = byProv.get(r.province) ?? []
    return pool.filter(
      (h) => (r.fr && (keyFr(h.fr) === r.fr || ALIASES[r.fr] === keyFr(h.fr))) || (r.ar && keyAr(h.ar) === r.ar),
    )
  }
  const pending = []
  // 1. ref + name
  for (const r of osmList) {
    const h = hcpMap.get(r.ref)
    if (h && namesAgree(r, h)) claim(r, h.code, "ref")
    else if (h && ALIAS_BY_CODE[h.code] && keyFr(ALIAS_BY_CODE[h.code]) === r.fr) claim(r, h.code, "alias")
    else pending.push(r)
  }
  // 2. name within the province
  const pending2 = []
  for (const r of pending) {
    const m = nameMatches(r).filter((h) => !claimed.has(h.code))
    if (m.length === 1) claim(r, m[0].code, "name")
    else pending2.push(r)
  }
  // 3. ref only
  const unmatchedOsm = []
  const refOnly = []
  for (const r of pending2) {
    const h = hcpMap.get(r.ref)
    if (h && !claimed.has(h.code)) {
      claim(r, h.code, "ref-only")
      refOnly.push({ osm: r.id, osmName: r.rawName, code: h.code, hcp: `${h.fr} / ${h.ar}` })
    } else unmatchedOsm.push({ osm: r.id, name: r.rawName, ref: r.ref || null, provinceAtPoint: r.province })
  }
  const dup = [...claimed].filter(([, rs]) => rs.length > 1).map(([code, rs]) => ({ code, osm: rs.map((r) => r.id) }))
  const missing = [...hcpMap.values()].filter((h) => !claimed.has(h.code)).map((h) => ({ code: h.code, fr: h.fr, ar: h.ar }))
  const counts = { ref: 0, alias: 0, name: 0, "ref-only": 0 }
  for (const v of how.values()) counts[v.how]++
  console.error(
    `${label}: ${claimed.size}/${hcpMap.size} HCP codes have a shape (${JSON.stringify(counts)}); ` +
      `${unmatchedOsm.length} OSM shapes unmatched, ${dup.length} codes with several shapes (merged)`,
  )
  return { claimed, counts, refOnly, unmatchedOsm, dup, missing }
}

// ---------- communes ----------
const hcpC = new Map(COMMUNES.map((c) => [c.code, { code: c.code, fr: c.fr, ar: c.ar, province: c.province }]))
const communeOsm = level(8)
const C = matchLayer(communeOsm, hcpC, (h) => h.province, "communes")

// Several OSM pieces for one code -> one MultiPolygon.
function merged(rs) {
  const polys = []
  for (const r of rs) {
    const g = r.f.geometry
    if (g.type === "Polygon") polys.push(g.coordinates)
    else polys.push(...g.coordinates)
  }
  return polys.length === 1 ? { type: "Polygon", coordinates: polys[0] } : { type: "MultiPolygon", coordinates: polys }
}

const provinceMismatch = []
const communeFeatures = []
for (const [code, rs] of C.claimed) {
  const h = hcpCommune.get(code)
  const region = h.province.slice(0, 2)
  for (const r of rs) if (r.province !== h.province) provinceMismatch.push({ code, fr: h.fr, osm: r.id, provinceAtPoint: r.province })
  communeFeatures.push({
    type: "Feature",
    properties: { code, province: h.province, region, fr: h.fr, ar: h.ar },
    geometry: merged(rs),
  })
}

// ---------- arrondissements ----------
const hcpA = new Map(
  ARRS.map((a) => [a.code, { code: a.code, fr: a.name.fr, ar: a.name.ar, commune: a.commune, province: hcpCommune.get(a.commune).province }]),
)
const arrOsm = [...level(9), ...level(10)].filter((r) => r.ref.split(".").length === 4 || /arrondissement|مقاطعه/i.test(r.rawName ?? ""))
const A = matchLayer(
  arrOsm.filter((r) => [...hcpA.values()].some((h) => h.province === r.province)),
  hcpA,
  (h) => h.province,
  "arrondissements",
)
const arrFeatures = []
for (const [code, rs] of A.claimed) {
  const h = hcpA.get(code)
  arrFeatures.push({
    type: "Feature",
    properties: { code, commune: h.commune, city: hcpCommune.get(h.commune).fr, fr: h.fr, ar: h.ar },
    geometry: merged(rs),
  })
}

// ---------- simplify + write ----------
const tmp = mkdtempSync(join(tmpdir(), "maroc-geo-map-"))
const mapshaper = (args) => execFileSync("npx", ["-y", "mapshaper@0.7", ...args], { stdio: ["ignore", "inherit", "inherit"] })
// GeoJSON from OSM follows the right-hand rule loosely; mapshaper fixes winding.
writeFileSync(join(tmp, "communes.geojson"), JSON.stringify({ type: "FeatureCollection", features: communeFeatures }))
writeFileSync(join(tmp, "arrondissements.geojson"), JSON.stringify({ type: "FeatureCollection", features: arrFeatures }))

// Communes: simplify the whole country at once (shared borders stay shared),
// then split per region.
const SIMPLIFY = process.env.SIMPLIFY ?? "interval=120"
mkdirSync(join(tmp, "split"))
mapshaper([
  "-i", join(tmp, "communes.geojson"), "name=communes",
  "-clean", "-simplify", SIMPLIFY, "keep-shapes",
  "-split", "region",
  "-o", join(tmp, "split", "c.json"), "format=topojson", "quantization=100000", "singles",
])
for (const file of readdirSync(join(tmp, "split"))) {
  const t = JSON.parse(readFileSync(join(tmp, "split", file), "utf8"))
  const key = Object.keys(t.objects)[0]
  const region = t.objects[key].geometries[0].properties.region
  t.objects = { communes: t.objects[key] }
  writeFileSync(join(OUT, `communes-${region}.topo.json`), JSON.stringify(t))
}
mapshaper([
  "-i", join(tmp, "arrondissements.geojson"), "name=arrondissements",
  "-clean", "-simplify", "interval=25", "keep-shapes",
  "-o", join(OUT, "arrondissements.topo.json"), "format=topojson", "quantization=100000",
])

// ---------- report ----------
const southern = communeFeatures.filter((f) => ["10", "11", "12"].includes(f.properties.region)).length
const report = {
  built: new Date().toISOString().slice(0, 10),
  sources: {
    geometry: "https://download.geofabrik.de/africa/morocco-latest.osm.pbf (ODbL 1.0, (c) OpenStreetMap contributors)",
    codes: "HCP RGPH 2024 via morocco-communes@1.9.1 (CC BY 4.0, Haut-Commissariat au Plan)",
    osmTimestamp: process.env.OSM_TIMESTAMP ?? null,
  },
  communes: {
    hcpTotal: hcpC.size,
    withShape: C.claimed.size,
    byMethod: C.counts,
    southernProvincesWithShape: southern,
    missing: C.missing,
    refOnly: C.refOnly,
    unmatchedOsm: C.unmatchedOsm,
    severalShapesMerged: C.dup,
    provinceMismatch,
  },
  arrondissements: {
    hcpTotal: hcpA.size,
    withShape: A.claimed.size,
    byMethod: A.counts,
    missing: A.missing,
    refOnly: A.refOnly,
    unmatchedOsm: A.unmatchedOsm,
    severalShapesMerged: A.dup,
  },
}
writeFileSync(join(OUT, "match-report.json"), JSON.stringify(report, null, 1) + "\n")
for (const f of readdirSync(OUT).sort()) console.error(`${f}\t${(statSync(join(OUT, f)).size / 1024).toFixed(0)} KB`)
