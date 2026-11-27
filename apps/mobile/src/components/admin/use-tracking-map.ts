import { useEffect, useMemo, useState } from "react";
import { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { router } from "expo-router";
import type { MapMarker } from "vardhan-maps/react-native";
import { operatingStatesOf, type LatLng } from "../../lib/operating-states";
import type { CheckinMarker, DuesBand, MapCustomer, RoutePoint, TrackedExecutive } from "../../lib/admin-tracking";
import {
  buildCheckinMarkers,
  buildCustomerMarkers,
  buildRepMarkers,
  buildRoutes,
  computeFitKey,
  coordKey,
} from "./tracking-map-model";
import { resolveMarkerTap } from "./tracking-map-tap";

export type OpenCard =
  | { kind: "customer"; data: MapCustomer }
  | { kind: "checkin"; data: CheckinMarker }
  | null;

interface Props {
  visible: TrackedExecutive[];
  customers: MapCustomer[];
  checkins: CheckinMarker[];
  route: RoutePoint[];
  routeStale?: boolean;
  selectedId: string | null;
  setSelectedId: (id: string) => void;
  bands: DuesBand[];
}

/** All derived map state + the tap handlers for {@link TrackingMap}. */
export function useTrackingMap(p: Props) {
  const allMarkers = useMemo<MapMarker[]>(
    () => [...buildCustomerMarkers(p.customers), ...buildCheckinMarkers(p.checkins), ...buildRepMarkers(p.visible)],
    [p.customers, p.checkins, p.visible],
  );

  const operatingStates = useMemo(() => {
    const pts: LatLng[] = [
      ...allMarkers.map((m) => ({ lat: m.lat, lng: m.lng })),
      ...p.route.map((r) => ({ lat: r.latitude, lng: r.longitude })),
    ];
    return operatingStatesOf(pts);
  }, [allMarkers, p.route]);

  const customerByCoord = useMemo(() => {
    const m = new Map<string, MapCustomer>();
    for (const c of p.customers) m.set(coordKey(c.lat, c.lng), c);
    return m;
  }, [p.customers]);
  const checkinByCoord = useMemo(() => {
    const m = new Map<string, CheckinMarker>();
    for (const c of p.checkins) m.set(coordKey(c.lat, c.lng), c);
    return m;
  }, [p.checkins]);

  const selectedExec = useMemo(() => p.visible.find((e) => e.userId === p.selectedId), [p.visible, p.selectedId]);
  const routeReady = !p.routeStale && p.route.length > 1;
  const routes = useMemo(() => buildRoutes(routeReady, p.route, selectedExec), [routeReady, p.route, selectedExec]);
  const fitKey = computeFitKey(routeReady, p.route, p.selectedId, allMarkers.length);

  const [card, setCard] = useState<OpenCard>(null);
  const onMarkerTap = (m: MapMarker) => {
    const r = resolveMarkerTap(m, checkinByCoord, p.visible, customerByCoord);
    if (r?.kind === "checkin") setCard({ kind: "checkin", data: r.data });
    else if (r?.kind === "rep") {
      setCard(null);
      p.setSelectedId(r.userId);
    } else if (r?.kind === "customer") setCard({ kind: "customer", data: r.data });
  };
  const openCustomer = (id: string, name: string) => {
    setCard(null);
    router.push({ pathname: "/customer/[id]", params: { id, name } });
  };

  // Veil cross-fade on each rep change.
  const veil = useSharedValue(0);
  useEffect(() => {
    veil.value = withSequence(withTiming(0.16, { duration: 0 }), withTiming(0, { duration: 550, easing: Easing.out(Easing.cubic) }));
  }, [p.selectedId, veil]);
  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.value }));

  // Reveal the map once fully rendered (10s safety net), fading out the loader.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setReady(true), 10_000);
    return () => clearTimeout(id);
  }, []);
  const loaderOpacity = useSharedValue(1);
  useEffect(() => {
    if (ready) loaderOpacity.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.ease) });
  }, [ready, loaderOpacity]);
  const loaderStyle = useAnimatedStyle(() => ({ opacity: loaderOpacity.value }));

  return { allMarkers, operatingStates, routes, fitKey, card, setCard, onMarkerTap, openCustomer, ready, setReady, veilStyle, loaderStyle };
}
