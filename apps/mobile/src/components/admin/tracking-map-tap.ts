import type { MapMarker } from "vardhan-maps/react-native";
import type { CheckinMarker, MapCustomer, TrackedExecutive } from "../../lib/admin-tracking";
import { coordKey } from "./tracking-map-model";

export type TapResult =
  | { kind: "checkin"; data: CheckinMarker }
  | { kind: "rep"; userId: string }
  | { kind: "customer"; data: MapCustomer }
  | null;

/** Dispatch a marker tap: check-ins win over the base customer dot at the same
 *  spot, then a rep dot, then the plain customer dot. */
export function resolveMarkerTap(
  m: MapMarker,
  checkinByCoord: Map<string, CheckinMarker>,
  visible: TrackedExecutive[],
  customerByCoord: Map<string, MapCustomer>,
): TapResult {
  const key = coordKey(m.lat, m.lng);
  const ci = checkinByCoord.get(key);
  if (ci) return { kind: "checkin", data: ci };
  const ex = visible.find((e) => e.lastLatitude === m.lat && e.lastLongitude === m.lng);
  if (ex) return { kind: "rep", userId: ex.userId };
  const cu = customerByCoord.get(key);
  if (cu) return { kind: "customer", data: cu };
  return null;
}
