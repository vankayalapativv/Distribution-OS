import { describe, expect, it } from "vitest";
import { mapPageHtml } from "./map-page";
import type { VardhanMapSpec } from "./spec";

const spec: VardhanMapSpec = {
  version: "1",
  map: { region: "state", state: "Telangana" },
  visualization: "choropleth",
  data: [{ key: "Khammam", value: 42 }],
  options: { title: "Sales by district" },
};

describe("mapPageHtml", () => {
  it("returns an HTML document with the mount node", () => {
    const html = mapPageHtml(spec);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<div id="app"></div>');
  });

  it("loads the published 0.17.0 renderer + spec adapter from the CDN", () => {
    const html = mapPageHtml(spec);
    expect(html).toContain("vardhan-maps@0.17.0/react");
    expect(html).toContain("vardhan-maps@0.17.0/spec");
    expect(html).toContain("specToLeafletProps");
  });

  it("loads the vector-basemap libraries so roads/labels render", () => {
    const html = mapPageHtml(spec);
    // Pinned to the web app's versions (maplibre-gl v6 silently breaks pmtiles).
    expect(html).toContain("maplibre-gl@4.7.1");
    expect(html).toContain("@maplibre/maplibre-gl-leaflet@0.1.4");
    expect(html).toContain("pmtiles@4.5.0");
    expect(html).toContain("maplibre-gl@4.7.1/dist/maplibre-gl.css");
  });

  it("embeds the spec and uses the title", () => {
    const html = mapPageHtml(spec);
    expect(html).toContain("Khammam");
    expect(html).toContain("<title>Sales by district</title>");
  });

  it("defaults the title when none is given", () => {
    expect(mapPageHtml({ ...spec, options: undefined })).toContain("<title>Vardhan Map</title>");
  });

  it("escapes '<' in the embedded spec so a label can't break out of the script", () => {
    const evil: VardhanMapSpec = {
      version: "1",
      map: { region: "india" },
      visualization: "markers",
      markers: [{ lat: 1, lng: 2, label: "</script><script>alert(1)</script>" }],
    };
    const html = mapPageHtml(evil);
    // The spec's "</script>" must appear only as escaped \u003c, never literally in the data.
    expect(html).toContain("\\u003c/script>");
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("escapes HTML in the title", () => {
    const html = mapPageHtml({ ...spec, options: { title: "A & B <x>" } });
    expect(html).toContain("<title>A &amp; B &lt;x&gt;</title>");
  });
});
