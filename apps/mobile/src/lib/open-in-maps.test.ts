import { afterEach, describe, expect, it, vi } from "vitest";
import { openLocationInMaps } from "./open-in-maps";

const openURL = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
vi.mock("react-native", () => ({ Linking: { openURL: (...a: unknown[]) => openURL(...a) } }));

afterEach(() => vi.clearAllMocks());

describe("openLocationInMaps", () => {
  it("drops a pin at the saved coordinates when present", () => {
    openLocationInMaps({ latitude: 17.25, longitude: 80.15, address: "12 MG Road" });
    expect(openURL).toHaveBeenCalledWith("https://www.google.com/maps/search/?api=1&query=17.25,80.15");
  });

  it("falls back to an address search without coordinates", () => {
    openLocationInMaps({ latitude: null, longitude: null, address: "12 MG Road, Khammam" });
    expect(openURL).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent("12 MG Road, Khammam")));
  });

  it("does nothing when there is nothing to search", () => {
    openLocationInMaps({ latitude: null, longitude: null, address: "  " });
    expect(openURL).not.toHaveBeenCalled();
  });

  it("treats a missing address as empty", () => {
    openLocationInMaps({ latitude: null, longitude: null });
    expect(openURL).not.toHaveBeenCalled();
  });

  it("swallows a failure to open the maps URL", () => {
    openURL.mockReturnValueOnce(Promise.reject(new Error("no maps")));
    expect(() => openLocationInMaps({ latitude: 1, longitude: 2 })).not.toThrow();
  });
});
