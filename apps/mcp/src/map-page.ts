import type { VardhanMapSpec } from "./spec";

/**
 * HTML for the interactive `/m/<id>` page. The spec is inlined; the page loads the
 * published renderer (`vardhan-maps@0.17.0/react`) + its `specToLeafletProps`
 * adapter (`vardhan-maps@0.17.0/spec`) + peers from a CDN, and hydrates.
 *
 * NOTE: this page runs in a browser and depends on CDN module + peer resolution;
 * verify it in a real browser and pin/adjust the CDN + CSP before shipping.
 */
export function mapPageHtml(spec: VardhanMapSpec): string {
  const title = spec.options?.title ?? "Vardhan Map";
  const specJson = JSON.stringify(spec).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="https://esm.sh/leaflet@1.9.4/dist/leaflet.css" />
<link rel="stylesheet" href="https://esm.sh/maplibre-gl@4.7.1/dist/maplibre-gl.css" />
<style>html,body,#app{height:100%;margin:0}#app{font-family:system-ui,sans-serif}</style>
</head>
<body>
<div id="app"></div>
<script type="module">
import React from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import { IndiaLeafletMap } from "https://esm.sh/vardhan-maps@0.17.0/react?deps=react@18.3.1,leaflet@1.9.4,maplibre-gl@4.7.1,@maplibre/maplibre-gl-leaflet@0.1.4,pmtiles@4.5.0";
import { specToLeafletProps } from "https://esm.sh/vardhan-maps@0.17.0/spec";

const spec = ${specJson};
const props = { ...specToLeafletProps(spec), style: { height: "100%", width: "100%" } };
createRoot(document.getElementById("app")).render(React.createElement(IndiaLeafletMap, props));
</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
