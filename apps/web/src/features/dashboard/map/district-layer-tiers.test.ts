import { afterEach, describe, expect, it, vi } from "vitest";
import type { BandMeta, MapCustomer } from "./map-helpers";

const geo = { addTo: vi.fn() };
vi.mock("leaflet", () => ({ default: { geoJSON: vi.fn(() => geo) } }));
const drawHeatRegion = vi.fn();
const drawDot = vi.fn();
const drawCountBadges = vi.fn();
vi.mock("./district-layer-parts", () => ({
  drawHeatRegion: (...a: unknown[]) => drawHeatRegion(...a),
  drawDot: (...a: unknown[]) => drawDot(...a),
  drawCountBadges: (...a: unknown[]) => drawCountBadges(...a),
}));

import { drawDistrictDetail, drawStateDetail, drawStatesOverview } from "./district-layer-tiers";

const meta = {} as BandMeta;
const c = (id: string): MapCustomer => ({ id } as MapCustomer);
const feat = (name: string | null): GeoJSON.Feature => ({ type: "Feature", properties: name == null ? null : { name } }) as GeoJSON.Feature;
const map = () => ({ flyToBounds: vi.fn() }) as unknown as import("leaflet").Map;
const lastOnClick = () => drawHeatRegion.mock.calls.at(-1)![7] as (l: unknown) => void;

afterEach(() => vi.clearAllMocks());

describe("drawStatesOverview", () => {
  it("draws heat only for states with customers, and a state click selects + frames it", () => {
    const m = map();
    const setState = vi.fn();
    drawStatesOverview({} as never, m, [feat("Telangana"), feat("Empty"), feat(null)], new Map([["Telangana", [c("1")]]]), setState, meta);
    expect(drawHeatRegion).toHaveBeenCalledTimes(1); // Empty + null-props skipped
    lastOnClick()({ getBounds: () => "B" });
    expect(setState).toHaveBeenCalledWith("Telangana");
    expect(m.flyToBounds).toHaveBeenCalledWith("B", expect.objectContaining({ maxZoom: 8 }));
    expect(drawCountBadges).toHaveBeenCalled();
  });
});

describe("drawStateDetail", () => {
  it("borders empty districts, heats populated ones, draws the state outline, badges + dots", () => {
    const m = map();
    const setDistrict = vi.fn();
    drawStateDetail({} as never, m, feat("Telangana"), [feat("Hyd"), feat("NoCust")], new Map([["Hyd", [c("1"), c("2")]]]), setDistrict, meta);
    expect(drawHeatRegion).toHaveBeenCalledTimes(1); // Hyd only
    expect(geo.addTo).toHaveBeenCalledTimes(2); // NoCust border + state outline
    lastOnClick()({ getBounds: () => "B" });
    expect(setDistrict).toHaveBeenCalledWith("Hyd");
    expect(m.flyToBounds).toHaveBeenCalledWith("B", expect.objectContaining({ maxZoom: 12 }));
    expect(drawDot).toHaveBeenCalledTimes(2);
  });

  it("skips the state outline when no state feature is given", () => {
    drawStateDetail({} as never, map(), undefined, [], new Map(), vi.fn(), meta);
    expect(geo.addTo).not.toHaveBeenCalled();
  });
});

describe("drawDistrictDetail", () => {
  it("outlines the found district and draws its dots", () => {
    drawDistrictDetail({} as never, [feat("Hyd")], new Map([["Hyd", [c("1")]]]), "Hyd", meta);
    expect(geo.addTo).toHaveBeenCalledTimes(1);
    expect(drawDot).toHaveBeenCalledTimes(1);
  });
  it("no outline + no dots when the district isn't present", () => {
    drawDistrictDetail({} as never, [feat("Hyd")], new Map(), "Ghost", meta); // find → undefined, get ?? []
    expect(geo.addTo).not.toHaveBeenCalled();
    expect(drawDot).not.toHaveBeenCalled();
  });
});
