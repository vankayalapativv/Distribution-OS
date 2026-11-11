/**
 * VardhanMapSpec — the serialisable map contract (a lean copy of
 * `vardhan-maps/spec`, types + validation only, so the Worker stays tiny and does
 * NOT pull the geometry payload). The interactive `/m/<id>` page loads the real
 * renderer (`vardhan-maps/react`) from a CDN and hydrates from a stored spec.
 */
export type VardhanVisualization = "default" | "choropleth" | "markers" | "routes" | "heatmap";

export interface VardhanMapSpec {
  version: "1";
  map: {
    region: "india" | "state" | "district";
    state?: string;
    states?: string[];
    /** Focus a specific SET of districts (state-qualified) — draws only these +
     *  their state boundary and clips to them (a client's operating area). */
    districts?: { state: string; name: string }[];
  };
  visualization: VardhanVisualization;
  data?: { key: string; value: number }[];
  markers?: { lat: number; lng: number; label?: string; color?: string; radius?: number; popup?: string; permanent?: boolean }[];
  routes?: { points: { lat: number; lng: number; label?: string }[]; color?: string; weight?: number; label?: string; showPoints?: boolean }[];
  options?: { title?: string; legend?: boolean; tooltip?: boolean; basemap?: "vector" | "raster" | "none"; colors?: string[] };
}

export interface SpecError {
  path: string;
  message: string;
}

const REGIONS = new Set(["india", "state", "district"]);
const VISUALS = new Set(["default", "choropleth", "markers", "routes", "heatmap"]);
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

type PartialSpec = Partial<VardhanMapSpec>;

function baseErrors(s: PartialSpec): SpecError[] {
  const e: SpecError[] = [];
  if (s.version !== "1") e.push({ path: "version", message: 'version must be "1".' });
  if (!s.map || !REGIONS.has(s.map.region))
    e.push({ path: "map.region", message: "region must be india, state or district." });
  if (!s.visualization || !VISUALS.has(s.visualization))
    e.push({ path: "visualization", message: "unknown visualization." });
  return e;
}

function dataErrors(s: PartialSpec): SpecError[] {
  const e: SpecError[] = [];
  const needsData = s.visualization === "choropleth" || s.visualization === "heatmap";
  if (needsData && !(Array.isArray(s.data) && s.data.length > 0))
    e.push({ path: "data", message: `${s.visualization} needs a non-empty data array.` });
  for (const [i, d] of (s.data ?? []).entries()) {
    if (!d || typeof d.key !== "string" || !d.key.trim())
      e.push({ path: `data[${i}].key`, message: "key must be a non-empty string." });
    if (!num(d?.value)) e.push({ path: `data[${i}].value`, message: "value must be a number." });
  }
  return e;
}

function markerRouteErrors(s: PartialSpec): SpecError[] {
  const e: SpecError[] = [];
  if (s.visualization === "markers" && !(s.markers && s.markers.length))
    e.push({ path: "markers", message: "markers visualization needs markers." });
  if (s.visualization === "routes" && !(s.routes && s.routes.length))
    e.push({ path: "routes", message: "routes visualization needs routes." });
  for (const [i, m] of (s.markers ?? []).entries())
    if (!num(m?.lat) || !num(m?.lng)) e.push({ path: `markers[${i}]`, message: "marker needs numeric lat/lng." });
  for (const [i, r] of (s.routes ?? []).entries())
    if (!Array.isArray(r?.points) || r.points.length < 2)
      e.push({ path: `routes[${i}].points`, message: "a route needs at least two points." });
  return e;
}

function districtErrors(s: PartialSpec): SpecError[] {
  const e: SpecError[] = [];
  for (const [i, d] of (s.map?.districts ?? []).entries())
    if (!d || typeof d.state !== "string" || !d.state.trim() || typeof d.name !== "string" || !d.name.trim())
      e.push({ path: `map.districts[${i}]`, message: "each district needs a state and a name." });
  return e;
}

/** Validate a value as a VardhanMapSpec. Returns [] when valid, else the problems. */
export function validateSpec(spec: unknown): SpecError[] {
  const s = spec as PartialSpec | null;
  if (!s || typeof s !== "object") return [{ path: "", message: "Spec must be an object." }];
  return [...baseErrors(s), ...dataErrors(s), ...markerRouteErrors(s), ...districtErrors(s)];
}
