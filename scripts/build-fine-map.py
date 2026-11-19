#!/usr/bin/env python3
"""
Step 1 of the fine map build: pull every administrative boundary of Morocco
out of the OpenStreetMap extract and write it as one GeoJSON file.

Source (ODbL 1.0, (c) OpenStreetMap contributors):
  https://download.geofabrik.de/africa/morocco-latest.osm.pbf
  Geofabrik's "morocco" extract covers the whole Kingdom, Southern Provinces
  included (its clipping polygon goes down to 20.4 N:
  https://download.geofabrik.de/africa/morocco.poly).

Needs pyosmium + shapely (pip install osmium shapely, e.g. in a venv).

Usage:
  python3 scripts/build-fine-map.py morocco-latest.osm.pbf out/admin.geojson

Writes one feature per boundary=administrative relation with admin_level 4..10
(4 region, 5 province/prefecture, 8 commune, 9 arrondissement in Moroccan OSM
tagging), properties {osm_id, admin_level, name, name:fr, name:ar, name:en,
ref, ref:hcp...}. Step 2 is scripts/build-fine-map.mjs.
"""
import json
import sys

import osmium
from osmium.filter import TagFilter

LEVELS = {"4", "5", "6", "7", "8", "9", "10"}
KEEP = ("name", "name:fr", "name:ar", "name:en", "name:zgh", "ref", "official_name",
        "official_name:fr", "alt_name", "alt_name:fr", "old_name", "wikidata", "admin_type:MA",
        "border_type", "is_in", "place")


def repair_missing(src, done):
    """Relations whose rings osmium could not close (a gap, a stray way) are
    rebuilt by polygonizing all their member ways with shapely. Marked
    repaired=true so the report can list them."""
    from shapely.geometry import LineString, mapping
    from shapely.ops import polygonize, unary_union

    rels = {}
    for r in osmium.FileProcessor(src, osmium.osm.RELATION).with_filter(TagFilter(("boundary", "administrative"))):
        lvl = r.tags.get("admin_level")
        if lvl in LEVELS and r.id not in done and "ref:MA:HCP" in r.tags:
            rels[r.id] = (dict(r.tags), [m.ref for m in r.members if m.type == "w"])
    if not rels:
        return []
    want = {w for _, ws in rels.values() for w in ws}
    lines = {}
    for w in osmium.FileProcessor(src, osmium.osm.WAY | osmium.osm.NODE).with_locations():
        if w.is_way() and w.id in want:
            lines[w.id] = LineString([(n.lon, n.lat) for n in w.nodes])
    out = []
    for rid, (tags, ws) in rels.items():
        polys = list(polygonize(unary_union([lines[w] for w in ws if w in lines])))
        if not polys:
            print(f"cannot repair r{rid} {tags.get('name')}", file=sys.stderr)
            continue
        geom = unary_union(polys)
        props = {"osm_id": rid, "admin_level": int(tags["admin_level"]), "repaired": True}
        for k in KEEP:
            if k in tags:
                props[k] = tags[k]
        for k, v in tags.items():
            if k.startswith("ref:"):
                props[k] = v
        print(f"repaired r{rid} {tags.get('name')} from {len(ws)} ways", file=sys.stderr)
        out.append({"type": "Feature", "properties": props, "geometry": mapping(geom)})
    return out


def main(src, dst):
    geo = osmium.geom.GeoJSONFactory()
    fp = (osmium.FileProcessor(src)
          .with_areas(TagFilter(("boundary", "administrative")))
          .with_filter(osmium.filter.EntityFilter(osmium.osm.AREA)))
    feats = []
    for area in fp:
        if area.from_way():
            continue
        lvl = area.tags.get("admin_level")
        if lvl not in LEVELS:
            continue
        try:
            g = json.loads(geo.create_multipolygon(area))
        except Exception as e:  # broken ring: report, never drop silently
            print(f"skip r{area.orig_id()} {area.tags.get('name')}: {e}", file=sys.stderr)
            continue
        props = {"osm_id": area.orig_id(), "admin_level": int(lvl)}
        for k in KEEP:
            if k in area.tags:
                props[k] = area.tags[k]
        for k, v in area.tags:
            if k.startswith("ref:"):
                props[k] = v
        feats.append({"type": "Feature", "properties": props, "geometry": g})
    feats += repair_missing(src, {f["properties"]["osm_id"] for f in feats})
    with open(dst, "w") as f:
        json.dump({"type": "FeatureCollection", "features": feats}, f, ensure_ascii=False)
    counts = {}
    for ft in feats:
        counts[ft["properties"]["admin_level"]] = counts.get(ft["properties"]["admin_level"], 0) + 1
    print("relations per admin_level:", dict(sorted(counts.items())), file=sys.stderr)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
