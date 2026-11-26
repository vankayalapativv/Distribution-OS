import { afterEach, describe, expect, it, vi } from "vitest";
import { getCheckInFix, reverseGeocodeFix } from "./gps-geocode";

const reverseGeocodeAsync = vi.fn();
const requestForegroundPermissionsAsync = vi.fn();
const getCurrentPositionAsync = vi.fn();
const getLastKnownPositionAsync = vi.fn();
vi.mock("expo-location", () => ({
  reverseGeocodeAsync: (...a: unknown[]) => reverseGeocodeAsync(...a),
  requestForegroundPermissionsAsync: () => requestForegroundPermissionsAsync(),
  getCurrentPositionAsync: (...a: unknown[]) => getCurrentPositionAsync(...a),
  getLastKnownPositionAsync: () => getLastKnownPositionAsync(),
  Accuracy: { High: 5 },
}));

afterEach(() => vi.clearAllMocks());

describe("reverseGeocodeFix", () => {
  it("extracts the city from the formatted address (element before State PIN)", async () => {
    reverseGeocodeAsync.mockResolvedValue([{
      formattedAddress: "12 St, Dhamsalapuram, Khammam, Telangana 507002, India",
      region: "Telangana", postalCode: "507002", city: "Dhamsalapuram", subregion: "Khammam District",
    }]);
    await expect(reverseGeocodeFix(1, 2)).resolves.toEqual({ city: "Khammam", state: "Telangana", pincode: "507002" });
  });
  it("falls back to city then subregion when the formatted address has no match", async () => {
    reverseGeocodeAsync.mockResolvedValue([{ formattedAddress: null, region: "TS", postalCode: null, city: "Town", subregion: "Dist" }]);
    await expect(reverseGeocodeFix(1, 2)).resolves.toEqual({ city: "Town", state: "TS", pincode: null });
  });
  it("uses place.city when the formatted address has no state/pincode boundary", async () => {
    reverseGeocodeAsync.mockResolvedValue([{
      formattedAddress: "Some Road, Some Area, India", region: "Telangana", postalCode: "999999",
      city: "FallbackCity", subregion: null,
    }]);
    await expect(reverseGeocodeFix(1, 2)).resolves.toMatchObject({ city: "FallbackCity" });
  });
  it("matches the boundary by pincode when the state is absent", async () => {
    reverseGeocodeAsync.mockResolvedValue([{
      formattedAddress: "Street, Nagar, Khammam 507002, India",
      region: null, postalCode: "507002", city: "ignored", subregion: null,
    }]);
    await expect(reverseGeocodeFix(1, 2)).resolves.toMatchObject({ city: "Nagar", pincode: "507002" });
  });
  it("falls back to subregion when city is null and the address has no match", async () => {
    reverseGeocodeAsync.mockResolvedValue([{ formattedAddress: null, region: null, postalCode: null, city: null, subregion: "District" }]);
    await expect(reverseGeocodeFix(1, 2)).resolves.toEqual({ city: "District", state: null, pincode: null });
  });
  it("yields a null city when nothing resolves it", async () => {
    reverseGeocodeAsync.mockResolvedValue([{ formattedAddress: null, region: null, postalCode: null, city: null, subregion: null }]);
    await expect(reverseGeocodeFix(1, 2)).resolves.toEqual({ city: null, state: null, pincode: null });
  });
  it("returns null when there is no place or the geocoder throws", async () => {
    reverseGeocodeAsync.mockResolvedValue([]);
    await expect(reverseGeocodeFix(1, 2)).resolves.toBeNull();
    reverseGeocodeAsync.mockRejectedValue(new Error("no geocoder"));
    await expect(reverseGeocodeFix(1, 2)).resolves.toBeNull();
  });
});

describe("getCheckInFix", () => {
  it("returns null when foreground permission is denied", async () => {
    requestForegroundPermissionsAsync.mockResolvedValue({ granted: false });
    expect(await getCheckInFix()).toBeNull();
  });
  it("returns a fresh fix when the current position resolves", async () => {
    requestForegroundPermissionsAsync.mockResolvedValue({ granted: true });
    getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 17, longitude: 80, accuracy: 8 } });
    expect(await getCheckInFix()).toEqual({ latitude: 17, longitude: 80, accuracy: 8, fresh: true });
  });
  it("falls back to the last-known fix (fresh=false) when the current position errors", async () => {
    requestForegroundPermissionsAsync.mockResolvedValue({ granted: true });
    getCurrentPositionAsync.mockRejectedValue(new Error("gps stalled")); // → caught → null
    getLastKnownPositionAsync.mockResolvedValue({ coords: { latitude: 1, longitude: 2, accuracy: null } });
    expect(await getCheckInFix()).toEqual({ latitude: 1, longitude: 2, accuracy: null, fresh: false });
  });
  it("returns null when neither a current nor last-known fix is available", async () => {
    requestForegroundPermissionsAsync.mockResolvedValue({ granted: true });
    getCurrentPositionAsync.mockResolvedValue(null);
    getLastKnownPositionAsync.mockRejectedValue(new Error("no last known")); // → caught → null
    expect(await getCheckInFix()).toBeNull();
  });
});
