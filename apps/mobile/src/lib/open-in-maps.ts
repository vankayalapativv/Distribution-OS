import { Linking } from "react-native";

/**
 * Open a location in Google Maps — shared by the delivery invoice list and the
 * customer profile. Drops a pin at the saved coordinates when we have them,
 * otherwise text-searches the address so the user still gets something useful.
 * A blank target (no coordinates and no address) opens nothing.
 */
export function openLocationInMaps(loc: {
  latitude: number | null;
  longitude: number | null;
  address?: string | null;
}): void {
  const query =
    loc.latitude != null && loc.longitude != null
      ? `${loc.latitude},${loc.longitude}`
      : encodeURIComponent((loc.address ?? "").trim());
  if (!query) return;
  void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`).catch(() => undefined);
}
