import L from "leaflet";

// Hyderabad city centre (state capital).
export const HYDERABAD: [number, number] = [17.385, 78.4867];

// The four districts the client operates in (Greater Hyderabad / GHMC). Names
// match the district GeoJSON + system_settings.operating_area exactly.
export const HYDERABAD_DISTRICT_NAMES = [
  "Hyderabad",
  "Medchal–Malkajgiri",
  "Ranga Reddy",
  "Sangareddy",
] as const;
export const HYDERABAD_DISTRICT_SET: ReadonlySet<string> = new Set(HYDERABAD_DISTRICT_NAMES);

// Centre + zoom framing the operating districts, for renderers that take
// center/zoom (the tracking IndiaMap). The dashboard Customers Map opens framed
// to the whole Telangana state instead (see use-osm-map-init / create-region-map).
export const HYDERABAD_DISTRICTS_CENTER: [number, number] = [17.53, 78.14];
export const HYDERABAD_DISTRICTS_ZOOM = 9;

// Operating region — Telangana (the client works in Greater Hyderabad, which
// sits within Telangana). The map is hard-locked to this box (maxBounds +
// viscosity) with a minZoom that keeps the state filling the view, so it never
// drifts out to the whole world.
// NOTE: still consumed by the Live-Tracking map; the dashboard Customers Map has
// moved to the dynamic, India-wide framing below.
export const REGION_BOUNDS: [[number, number], [number, number]] = [
  [15.7, 77.1], // SW
  [19.95, 81.5], // NE
];
export const REGION_MIN_ZOOM = 6;

// India-wide framing for the dynamic, multi-state dashboard Customers Map. The
// map opens fit to the states that ACTUALLY have customers (geometrically
// derived — no hardcoded state), then pans freely within this generous India box
// (soft maxBounds, so it can't drift to the open ocean / whole world, but there
// is no hard regional lock).
export const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [6.0, 67.0], // SW
  [37.5, 98.5], // NE
];
export const INDIA_MIN_ZOOM = 4;

// State heat-map (overview): the SAME blue fill as the district heat, with a
// mid-grey state outline; a bold darker-blue border appears on hover.
export const STATE_LINE = { color: "#64748b", weight: 1.2, opacity: 0.85 };
// The selected state's own border in the state-detail view — a bold, dark outline
// drawn on top of its districts so the state's extent reads clearly and stands
// apart from the thinner district lines inside it.
export const SELECTED_STATE_LINE = { color: "#334155", weight: 2, opacity: 1 };

// District heat-map (overview): blue fill whose opacity scales with the customer
// count; a bold darker-blue outline on hover.
export const HEAT_COLOR = "#2563eb";
export const HEAT_HOVER_BORDER = "#1d4ed8";
// The light-grey district border — drawn ONLY around districts that have
// customers, under the heat fill in the overview.
export const DISTRICT_LINE = { color: "#94a3b8", weight: 1, opacity: 0.7 };
// The selected district's border in detail mode — a bold, dark grey outline so
// its full shape stands out clearly for analysis.
export const SELECTED_DISTRICT_LINE = { color: "#475569", weight: 3, opacity: 1 };

// Customer dot shape, shown when a district is zoomed into. The fill colour is
// set per-customer by dues-ageing bucket (see the detail branch).
export const DOT_STYLE: L.CircleMarkerOptions = {
  radius: 5,
  color: "#ffffff",
  weight: 1.5,
  fillOpacity: 0.95,
};
