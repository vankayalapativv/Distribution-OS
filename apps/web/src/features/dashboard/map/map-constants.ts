import L from "leaflet";
import { type DuesBucketKey } from "./map-helpers";

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
export const REGION_BOUNDS: [[number, number], [number, number]] = [
  [15.7, 77.1], // SW
  [19.95, 81.5], // NE
];
export const REGION_MIN_ZOOM = 6;

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

export const BUCKET_ORDER: DuesBucketKey[] = ["0_30", "30_45", "45_60", "60_plus"];
