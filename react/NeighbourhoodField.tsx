/**
 * "Quartier" field for a checkout form (React). Shows the well-known
 * neighbourhoods of the chosen city when focused, searches the full list as
 * the customer types (French, Arabic, typos), and still accepts a free value
 * when the neighbourhood is not in the list. Renders nothing for a city
 * without a list.
 *
 * Copy this file into your app (it is not part of the npm build). It expects
 * an API route that returns neighbourhoodsFor(city), so the 1 MB list stays on
 * the server. Next.js example (app/api/neighbourhoods/route.ts):
 *
 *   import { neighbourhoodsFor } from "maroc-geo/neighbourhoods";
 *   export function GET(req: Request) {
 *     const city = new URL(req.url).searchParams.get("city") ?? "";
 *     const list = neighbourhoodsFor(city);
 *     return Response.json(list ?? { main: [], all: [] }, { status: list ? 200 : 404 });
 *   }
 *
 * Unstyled: pass classNames, or target the data-mg attributes in CSS.
 */
import { useEffect, useMemo, useState } from "react";
import { normalizeText } from "../src/normalize.js";
import { searchNeighbourhoods, type Neighbourhood } from "../src/neighbourhoods.js";

type List = { main: Neighbourhood[]; all: Neighbourhood[] };

export function NeighbourhoodField({
  id,
  city,
  value,
  onChange,
  label = "Quartier",
  placeholder = "Choisissez ou tapez votre quartier",
  otherText = "Quartier absent de la liste : il sera gardé tel quel.",
  locale = "fr",
  endpoint = "/api/neighbourhoods",
  onAvailable,
  className,
}: {
  id: string;
  city: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  otherText?: string;
  locale?: "fr" | "ar";
  endpoint?: string;
  /** Called with false when the city has no list (e.g. to show a plain address field instead). */
  onAvailable?: (available: boolean) => void;
  className?: string;
}) {
  const [list, setList] = useState<List | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let live = true;
    fetch(`${endpoint}?city=${encodeURIComponent(city)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: List | null) => {
        if (!live) return;
        const ok = !!d?.main?.length;
        setList(ok ? d : null);
        onAvailable?.(ok);
      })
      .catch(() => {
        if (live) {
          setList(null);
          onAvailable?.(false);
        }
      });
    return () => {
      live = false;
    };
  }, [city, endpoint, onAvailable]);

  const results = useMemo(() => (list ? searchNeighbourhoods(list, value) : []), [list, value]);
  if (!list) return null;

  const q = normalizeText(value);
  const known = results.some((n) => normalizeText(n.fr) === q || (!!n.ar && normalizeText(n.ar) === q));
  const show = (n: Neighbourhood) => (locale === "ar" && n.ar ? n.ar : n.fr);
  const pick = (n: Neighbourhood) => {
    onChange(n.fr);
    setOpen(false);
  };

  return (
    <div data-mg="field" className={className} style={{ position: "relative" }}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        data-known={known || undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(e) => {
          onChange(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter" && open && results[active]) { e.preventDefault(); pick(results[active]); }
        }}
      />
      {open && (
        <ul id={`${id}-list`} role="listbox" data-mg="list" style={{ position: "absolute", insetInline: 0, top: "100%", zIndex: 30, maxHeight: 288, overflowY: "auto", margin: 0, padding: 0, listStyle: "none" }}>
          {results.map((n, i) => (
            <li key={n.fr} role="option" aria-selected={i === active} data-mg="option" ref={i === active ? (el) => el?.scrollIntoView({ block: "nearest" }) : undefined}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(n)} onMouseEnter={() => setActive(i)} style={{ display: "flex", width: "100%", justifyContent: "space-between", gap: 12 }}>
                <span>{show(n)}</span>
                {n.ar && locale !== "ar" && <span dir="rtl">{n.ar}</span>}
              </button>
            </li>
          ))}
          {value.trim() && !known && <li data-mg="other">{otherText}</li>}
        </ul>
      )}
    </div>
  );
}
