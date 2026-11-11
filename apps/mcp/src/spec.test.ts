import { describe, expect, it } from "vitest";
import { validateSpec, type VardhanMapSpec } from "./spec";

const paths = (spec: unknown) => validateSpec(spec).map((e) => e.path);

const choropleth: VardhanMapSpec = {
  version: "1",
  map: { region: "india" },
  visualization: "choropleth",
  data: [{ key: "Telangana", value: 72 }],
};

describe("validateSpec — valid specs", () => {
  it("accepts an india choropleth", () => {
    expect(validateSpec(choropleth)).toEqual([]);
  });
  it("accepts a state markers map", () => {
    expect(
      validateSpec({
        version: "1",
        map: { region: "state", state: "Telangana" },
        visualization: "markers",
        markers: [{ lat: 17.3, lng: 80.6, label: "Khammam" }],
      }),
    ).toEqual([]);
  });
  it("accepts a routes map", () => {
    expect(
      validateSpec({
        version: "1",
        map: { region: "district" },
        visualization: "routes",
        routes: [{ points: [{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }] }],
      }),
    ).toEqual([]);
  });
  it("accepts a default map with no data", () => {
    expect(validateSpec({ version: "1", map: { region: "india" }, visualization: "default" })).toEqual([]);
  });
});

describe("validateSpec — structural errors", () => {
  it("rejects a non-object", () => {
    expect(validateSpec(null)).toEqual([{ path: "", message: "Spec must be an object." }]);
    expect(validateSpec("x")[0].path).toBe("");
  });
  it("flags a wrong version, region and visualization", () => {
    const p = paths({ version: "2", map: { region: "moon" }, visualization: "pie" });
    expect(p).toEqual(expect.arrayContaining(["version", "map.region", "visualization"]));
  });
  it("flags a missing map object", () => {
    expect(paths({ version: "1", visualization: "default" })).toContain("map.region");
  });
});

describe("validateSpec — data errors", () => {
  it("requires non-empty data for choropleth and heatmap", () => {
    expect(paths({ version: "1", map: { region: "india" }, visualization: "choropleth" })).toContain("data");
    expect(paths({ version: "1", map: { region: "india" }, visualization: "heatmap", data: [] })).toContain("data");
  });
  it("flags a blank key and a non-numeric value", () => {
    const p = paths({
      version: "1",
      map: { region: "india" },
      visualization: "choropleth",
      data: [{ key: "  ", value: 5 }, { key: "AP", value: "x" }],
    });
    expect(p).toEqual(expect.arrayContaining(["data[0].key", "data[1].value"]));
  });
});

describe("validateSpec — marker/route errors", () => {
  it("requires markers/routes for their visualizations", () => {
    expect(paths({ version: "1", map: { region: "india" }, visualization: "markers" })).toContain("markers");
    expect(paths({ version: "1", map: { region: "india" }, visualization: "routes" })).toContain("routes");
  });
  it("flags a marker without numeric lat/lng", () => {
    const p = paths({
      version: "1",
      map: { region: "india" },
      visualization: "markers",
      markers: [{ lat: 1, lng: 2 }, { lat: "a", lng: 2 }],
    });
    expect(p).toContain("markers[1]");
  });
  it("flags a route with fewer than two points", () => {
    const p = paths({
      version: "1",
      map: { region: "india" },
      visualization: "routes",
      routes: [{ points: [{ lat: 1, lng: 2 }] }],
    });
    expect(p).toContain("routes[0].points");
  });

  it("flags a district-focus entry missing its state or name; accepts a good one", () => {
    expect(
      paths({ version: "1", map: { region: "district", districts: [{ state: "Telangana", name: "" }] }, visualization: "default" }),
    ).toContain("map.districts[0]");
    expect(
      validateSpec({ version: "1", map: { region: "district", districts: [{ state: "Telangana", name: "Nalgonda" }] }, visualization: "default" }),
    ).toEqual([]);
  });
});
