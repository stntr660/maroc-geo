/**
 * Map of Morocco: 12 regions and 75 provinces/prefectures (HCP RGPH 2024
 * borders, Western Sahara included as the regions of Guelmim-Oued Noun,
 * Laâyoune-Sakia El Hamra and Dakhla-Oued Ed-Dahab), plus helpers to draw it
 * as SVG with d3-geo. Framework-free: use it from React, Vue, Svelte or plain JS.
 *
 * Feature properties:
 *   regions   → { code: "06", region: "06" }
 *   provinces → { code: "06.141", region: "06" }
 *
 * Finer layers load on demand: loadCommunes(region), loadArrondissements(),
 * drawn with layoutLayer() on the same projection (see docs/MAP.md).
 */
import { geoMercator, geoPath, type GeoPath, type GeoProjection } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import topoData from "../data/morocco.topo.json" with { type: "json" };
import geonamesData from "../data/cities-geonames.json" with { type: "json" };

export type MapLevel = "regions" | "provinces";
export interface ShapeProps {
  code: string;
  region: string;
}
export type Shape = Feature<Geometry, ShapeProps>;

export interface CityPoint {
  geonameId: number;
  name: string;
  lat: number;
  lng: number;
  population: number;
  alternateNames: string[];
}

/** The raw TopoJSON (objects: "regions", "provinces"). */
export const MOROCCO_TOPOLOGY = topoData as unknown as Topology;

/** 180 places of 15,000+ inhabitants with coordinates (GeoNames), for city bubbles. */
export const CITY_POINTS: readonly CityPoint[] = geonamesData;

/** GeoJSON features for one level. */
export function moroccoShapes(level: MapLevel = "regions"): Shape[] {
  const obj = MOROCCO_TOPOLOGY.objects[level] as GeometryCollection<ShapeProps>;
  return (feature(MOROCCO_TOPOLOGY, obj) as unknown as FeatureCollection<Geometry, ShapeProps>).features;
}

export interface MoroccoMapLayout {
  shapes: Shape[];
  projection: GeoProjection;
  path: GeoPath;
  /** One SVG path with the inner borders only (draw it on top, no fill). */
  borders: string;
  /** SVG x/y of a lng/lat point, e.g. a city. */
  project: (lng: number, lat: number) => [number, number];
  /** viewBox string that zooms on one shape (with padding), or the whole map. */
  viewBoxFor: (code?: string | null, pad?: number) => string;
}

/** Fits the map into a width × height SVG and returns everything needed to draw it. */
export function layoutMorocco(width = 520, height = 560, level: MapLevel = "regions", margin = 12): MoroccoMapLayout {
  const shapes = moroccoShapes(level);
  const obj = MOROCCO_TOPOLOGY.objects[level] as GeometryCollection<ShapeProps>;
  const projection = geoMercator().fitExtent(
    [[margin, margin], [width - margin, height - margin]],
    { type: "FeatureCollection", features: shapes } as FeatureCollection,
  );
  const path = geoPath(projection);
  const borders = path(mesh(MOROCCO_TOPOLOGY, obj, (a, b) => a !== b)) ?? "";
  const whole = `0 0 ${width} ${height}`;
  return {
    shapes,
    projection,
    path,
    borders,
    project: (lng, lat) => (projection([lng, lat]) ?? [0, 0]) as [number, number],
    viewBoxFor: (code, pad = 0.12) => {
      const shape = code ? shapes.find((s) => s.properties.code === code) : null;
      if (!shape) return whole;
      const [[x0, y0], [x1, y1]] = path.bounds(shape);
      const w = (x1 - x0) * (1 + pad * 2);
      const h = (y1 - y0) * (1 + pad * 2);
      const s = Math.max(w / width, h / height);
      return `${(x0 + x1) / 2 - (width * s) / 2} ${(y0 + y1) / 2 - (height * s) / 2} ${width * s} ${height * s}`;
    },
  };
}

// ---------------------------------------------------------------------------
// Fine layers: communes (one file per region) and arrondissements.
// Built by scripts/build-fine-map.{py,mjs} from OpenStreetMap (ODbL 1.0,
// (c) OpenStreetMap contributors), keyed by HCP RGPH 2024 codes. They are
// loaded on demand so the base map stays small. See docs/MAP.md.
// ---------------------------------------------------------------------------

export interface CommuneShapeProps {
  /** HCP commune code, e.g. "06.141.01.0" (Casablanca). */
  code: string;
  /** HCP province code, e.g. "06.141". */
  province: string;
  /** HCP region code, e.g. "06". */
  region: string;
  fr: string;
  ar: string;
}
export interface ArrondissementShapeProps {
  /** HCP arrondissement code, e.g. "06.141.01.03". */
  code: string;
  /** HCP code of the commune it belongs to, e.g. "06.141.01.0". */
  commune: string;
  /** French name of that commune ("Casablanca"). */
  city: string;
  fr: string;
  ar: string;
}
export type CommuneShape = Feature<Geometry, CommuneShapeProps>;
export type ArrondissementShape = Feature<Geometry, ArrondissementShapeProps>;

/** Region codes that have a communes file ("01" … "12", Southern Provinces included). */
export const COMMUNE_MAP_REGIONS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"] as const;
export type CommuneMapRegion = (typeof COMMUNE_MAP_REGIONS)[number];

type TopoModule = { default: unknown };
// Literal paths so TypeScript copies the files and bundlers split one chunk per region.
const COMMUNE_FILES: Record<CommuneMapRegion, () => Promise<TopoModule>> = {
  "01": () => import("../data/map/communes-01.topo.json", { with: { type: "json" } }),
  "02": () => import("../data/map/communes-02.topo.json", { with: { type: "json" } }),
  "03": () => import("../data/map/communes-03.topo.json", { with: { type: "json" } }),
  "04": () => import("../data/map/communes-04.topo.json", { with: { type: "json" } }),
  "05": () => import("../data/map/communes-05.topo.json", { with: { type: "json" } }),
  "06": () => import("../data/map/communes-06.topo.json", { with: { type: "json" } }),
  "07": () => import("../data/map/communes-07.topo.json", { with: { type: "json" } }),
  "08": () => import("../data/map/communes-08.topo.json", { with: { type: "json" } }),
  "09": () => import("../data/map/communes-09.topo.json", { with: { type: "json" } }),
  "10": () => import("../data/map/communes-10.topo.json", { with: { type: "json" } }),
  "11": () => import("../data/map/communes-11.topo.json", { with: { type: "json" } }),
  "12": () => import("../data/map/communes-12.topo.json", { with: { type: "json" } }),
};

/**
 * Where the fine layers come from. By default they are imported from the
 * package (works in Node and in bundlers that understand JSON imports). Pass
 * your own loader to fetch them from a CDN instead, e.g.
 * `(file) => fetch(`https://cdn.example/maroc-geo/data/map/${file}`).then((r) => r.json())`.
 */
export type TopologySource = (file: string) => Promise<unknown>;

function toFeatures<P>(topo: unknown, object: string): Feature<Geometry, P>[] {
  const t = topo as Topology;
  const obj = t.objects[object] as GeometryCollection;
  if (!obj) throw new Error(`maroc-geo: no "${object}" object in this TopoJSON`);
  return (feature(t, obj) as unknown as FeatureCollection<Geometry, P>).features;
}

/** Commune shapes of one region (properties { code, province, region, fr, ar }). */
export async function loadCommunes(region: string, source?: TopologySource): Promise<CommuneShape[]> {
  const code = region.slice(0, 2) as CommuneMapRegion;
  const file = `communes-${code}.topo.json`;
  if (!COMMUNE_FILES[code]) throw new Error(`maroc-geo: unknown region "${region}"`);
  const topo = source ? await source(file) : (await COMMUNE_FILES[code]()).default;
  return toFeatures<CommuneShapeProps>(topo, "communes");
}

/** Arrondissement shapes of the 6 communes that have them (Casablanca, Rabat, Fès, Marrakech, Tanger, Salé). */
export async function loadArrondissements(source?: TopologySource): Promise<ArrondissementShape[]> {
  const topo = source
    ? await source("arrondissements.topo.json")
    : (await import("../data/map/arrondissements.topo.json", { with: { type: "json" } })).default;
  return toFeatures<ArrondissementShapeProps>(topo, "arrondissements");
}

export interface LayerLayout<P extends { code: string }> {
  shapes: Feature<Geometry, P>[];
  /** Same geoPath as the base layout: the layer nests exactly on the same SVG. */
  path: GeoPath;
  /** viewBox that zooms on one shape of this layer, or on the whole layer. */
  viewBoxFor: (code?: string | null, pad?: number) => string;
}

/**
 * Puts a fine layer (communes, arrondissements) on the projection of a base
 * layout from layoutMorocco(), so regions, provinces, communes and
 * arrondissements can be drawn in one <svg> and zoomed with the same viewBox.
 */
export function layoutLayer<P extends { code: string }>(
  base: Pick<MoroccoMapLayout, "path" | "projection">,
  shapes: Feature<Geometry, P>[],
  width = 520,
  height = 560,
): LayerLayout<P> {
  const path = base.path;
  const box = (fc: Feature | FeatureCollection, pad: number) => {
    const [[x0, y0], [x1, y1]] = path.bounds(fc);
    const w = (x1 - x0) * (1 + pad * 2);
    const h = (y1 - y0) * (1 + pad * 2);
    const s = Math.max(w / width, h / height);
    return `${(x0 + x1) / 2 - (width * s) / 2} ${(y0 + y1) / 2 - (height * s) / 2} ${width * s} ${height * s}`;
  };
  return {
    shapes,
    path,
    viewBoxFor: (code, pad = 0.08) => {
      const shape = code ? shapes.find((s) => s.properties.code === code) : null;
      return box(shape ?? ({ type: "FeatureCollection", features: shapes } as FeatureCollection), pad);
    },
  };
}

/** Opacity for a choropleth on one hue: square root scale so small values still show. */
export function shade(value: number, max: number, min = 0.14, span = 0.8): number {
  return value > 0 && max > 0 ? min + span * Math.sqrt(value / max) : 0;
}
