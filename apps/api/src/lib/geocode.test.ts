import { afterEach, describe, expect, it, vi } from "vitest";
import { photoGeoFromForm, reverseGeocode } from "./geocode";

afterEach(() => vi.restoreAllMocks());

function jsonRes(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as unknown as Response;
}

describe("photoGeoFromForm", () => {
  it("returns all nulls for a null form", async () => {
    expect(await photoGeoFromForm("key", null)).toEqual({ latitude: null, longitude: null, geocodedAddress: null });
  });

  it("uses the provided address verbatim (no geocoding)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const form = new FormData();
    form.set("latitude", "17.4");
    form.set("longitude", "78.4");
    form.set("address", "  Shop 1, Kukatpally  ");
    expect(await photoGeoFromForm("key", form)).toEqual({ latitude: 17.4, longitude: 78.4, geocodedAddress: "Shop 1, Kukatpally" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reverse-geocodes when coords are sent without an address", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonRes({ status: "OK", results: [{ formatted_address: "Google Addr" }] }));
    const form = new FormData();
    form.set("latitude", "17.4");
    form.set("longitude", "78.4");
    expect((await photoGeoFromForm("key", form)).geocodedAddress).toBe("Google Addr");
  });

  it("treats blank/invalid coords as null", async () => {
    const form = new FormData();
    form.set("latitude", "  ");
    form.set("longitude", "not-a-number");
    expect(await photoGeoFromForm("key", form)).toMatchObject({ latitude: null, longitude: null });
  });
});

describe("reverseGeocode", () => {
  it("returns null for non-finite coords", async () => {
    expect(await reverseGeocode("key", Number.NaN, 1)).toBeNull();
  });

  it("returns the Google address when Google succeeds", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonRes({ status: "OK", results: [{ formatted_address: "G Addr" }] }));
    expect(await reverseGeocode("key", 17.4, 78.4)).toBe("G Addr");
  });

  it("falls back to Nominatim when Google returns no result", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonRes({ status: "ZERO_RESULTS", results: [] }))
      .mockResolvedValueOnce(jsonRes({ display_name: "Nominatim Place, India" }));
    expect(await reverseGeocode("key", 17.4, 78.4)).toBe("Nominatim Place");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("goes straight to Nominatim when no Google key", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonRes({ display_name: "Free Place" }));
    expect(await reverseGeocode(undefined, 17.4, 78.4)).toBe("Free Place");
  });

  it("returns null from Google on a non-OK HTTP response", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonRes({}, false)) // google not ok
      .mockResolvedValueOnce(jsonRes({ display_name: "" }, false)); // nominatim not ok
    expect(await reverseGeocode("key", 17.4, 78.4)).toBeNull();
  });

  it("swallows fetch errors (never throws) → null", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    expect(await reverseGeocode("key", 17.4, 78.4)).toBeNull();
  });

  it("returns null when Nominatim has a non-string / empty display_name", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonRes({ display_name: 123 }));
    expect(await reverseGeocode(undefined, 17.4, 78.4)).toBeNull();
  });
});
