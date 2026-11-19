/**
 * Choropleth map of Morocco for React: regions shaded by a value, optional city
 * bubbles, click a region to zoom on it (click again to zoom out).
 *
 * Copy this file into your app (it is not part of the npm build) and style it
 * with the CSS variables below or your own classes.
 *
 *   <MoroccoMap
 *     values={{ "06": 120, "07": 40 }}          // by HCP region code
 *     cities={[{ name: "Casablanca", lat: 33.59, lng: -7.61, value: 90 }]}
 *     format={(v) => `${v} commandes`}
 *     locale="fr"
 *   />
 *
 * Colours: --mg-fill (shaded regions), --mg-empty (no data), --mg-border,
 * --mg-city, --mg-text.
 */
import { useMemo, useState } from "react";
import { layoutMorocco, shade, type MapLevel } from "../src/map.js";
import { REGIONS } from "../src/cities.js";
import { PROVINCES } from "../src/place.js";

export interface MapCity {
  name: string;
  lat: number;
  lng: number;
  value: number;
  /** Region code, to hide the city when another region is zoomed. */
  region?: string;
}

export function MoroccoMap({
  values,
  cities = [],
  level = "regions",
  locale = "fr",
  width = 520,
  height = 560,
  format = (v) => String(v),
  onSelect,
  className,
}: {
  values: Record<string, number>;
  cities?: MapCity[];
  level?: MapLevel;
  locale?: "fr" | "ar";
  width?: number;
  height?: number;
  format?: (v: number) => string;
  onSelect?: (code: string | null) => void;
  className?: string;
}) {
  const geo = useMemo(() => layoutMorocco(width, height, level), [width, height, level]);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const viewBox = geo.viewBoxFor(selected);
  const zoom = width / Number(viewBox.split(" ")[2]);
  const max = Math.max(0, ...Object.values(values));
  const shown = cities.filter((c) => !selected || level !== "regions" || !c.region || c.region === selected);
  const cityMax = Math.max(0, ...shown.map((c) => c.value));

  const names = level === "regions" ? REGIONS : PROVINCES;
  const nameOf = (code: string) => {
    const n = names.find((x) => x.code === code);
    return n ? (locale === "ar" ? n.ar : n.fr) : code;
  };

  const select = (code: string | null) => {
    setSelected(code);
    onSelect?.(code);
  };

  return (
    <svg viewBox={viewBox} className={className} style={{ width: "100%", height: "auto", transition: "all .5s" }} role="img" aria-label={locale === "ar" ? "خريطة المغرب" : "Carte du Maroc"}>
      {geo.shapes.map((s) => {
        const code = s.properties.code;
        const v = values[code] ?? 0;
        return (
          <path
            key={code}
            d={geo.path(s) ?? ""}
            fill={v > 0 ? "var(--mg-fill, #2251ff)" : "var(--mg-empty, #e5e7eb)"}
            fillOpacity={v > 0 ? shade(v, max) : 0.7}
            opacity={selected && code !== selected ? 0.3 : 1}
            stroke={hover === code ? "var(--mg-text, #111)" : "transparent"}
            strokeWidth={1.5 / zoom}
            style={{ cursor: "pointer", transition: "opacity .3s" }}
            onMouseEnter={() => setHover(code)}
            onMouseLeave={() => setHover(null)}
            onClick={() => select(code === selected ? null : code)}
          >
            <title>{`${nameOf(code)} · ${format(v)}`}</title>
          </path>
        );
      })}
      <path d={geo.borders} fill="none" stroke="var(--mg-border, #fff)" strokeWidth={1.2 / zoom} pointerEvents="none" />
      {shown.map((c) => {
        const [x, y] = geo.project(c.lng, c.lat);
        const r = (cityMax > 0 ? 3 + 14 * Math.sqrt(c.value / cityMax) : 3) / zoom;
        return (
          <g key={c.name}>
            <circle cx={x} cy={y} r={r} fill="var(--mg-city, #f97316)" fillOpacity={0.75} stroke="var(--mg-border, #fff)" strokeWidth={1.5 / zoom} />
            {(selected || r * zoom > 9) && (
              <text x={x + r + 3 / zoom} y={y} dominantBaseline="central" fontSize={10 / zoom} fill="var(--mg-text, #111)" pointerEvents="none">
                {c.name}
              </text>
            )}
            <title>{`${c.name} · ${format(c.value)}`}</title>
          </g>
        );
      })}
    </svg>
  );
}
