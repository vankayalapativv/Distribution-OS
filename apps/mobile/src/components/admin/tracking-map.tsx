import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { router } from "expo-router";
import { IndiaMapNative, type MapMarker, type MapRoute } from "vardhan-maps/react-native";
import { operatingStatesOf, type LatLng } from "../../lib/operating-states";
import {
  isLive,
  type CheckinMarker,
  type DuesBand,
  type MapCustomer,
  type RoutePoint,
  type TrackedExecutive,
} from "../../lib/admin-tracking";
import { bucketColor, CHECKIN_PLANNED, CHECKIN_UNPLANNED } from "../../lib/tracking-overlays";
import { CheckinCard, CustomerCard } from "./tracking-map-cards";

// A tapped marker is matched back to its data by exact coordinates.
function coordKey(lat: number, lng: number): string {
  return `${lat},${lng}`;
}

// Rep markers mirror the web: green when fresh/live, grey when stale (no blue
// selected highlight — selection shows via the rep strip + the drawn route).
function markerColor(live: boolean): string {
  return live ? LIVE : STALE;
}

// India-wide (2026-11-26): no hard-coded region. The map draws state borders +
// districts ONLY for the states the day's data actually touches (operatingStates,
// derived geometrically), auto-frames to the data, and pans freely over all India.
// When a day has NO data at all, the map opens on this India overview (so it never
// drifts to a world view now that the old regional lock is gone).
const INDIA_CENTER: [number, number] = [22.5, 80.0];
const INDIA_ZOOM = 4;
const LIVE = "#16a34a"; // green — fresh/live rep
const STALE = "#9ca3af"; // grey — stale rep
// GPS trail (web parity): a receding slate-400 line with slate-600 ping beads.
const ROUTE_LINE = "#94a3b8";
const ROUTE_BEAD = "#475569";

const IST_TIME = new Intl.DateTimeFormat("en-IN", {
  hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
});

/** SA tracking map on the self-hosted OSM vector basemap (vardhan-maps RN):
 *  rep markers (blue selected / green live / grey stale, name chip) + the
 *  selected rep's route with a red dot per ping. Fits to the selected route. */
export function TrackingMap({
  visible,
  route,
  routeStale,
  selectedId,
  setSelectedId,
  customers,
  bands,
  checkins,
}: {
  readonly visible: TrackedExecutive[];
  readonly customers: MapCustomer[];
  readonly bands: DuesBand[];
  readonly checkins: CheckinMarker[];
  readonly route: RoutePoint[];
  /** True in the just-selected gap while the new rep's route is still loading (the
   *  `route` in hand is the previous rep's) — fly to the new rep's marker at once. */
  readonly routeStale?: boolean;
  readonly selectedId: string | null;
  readonly setSelectedId: (id: string) => void;
}) {
  const markers = useMemo<MapMarker[]>(
    () =>
      visible.map((e) => ({
        lat: e.lastLatitude as number,
        lng: e.lastLongitude as number,
        label: e.name,
        permanent: true,
        color: markerColor(isLive(e)),
        radius: 7,
      })),
    [visible],
  );

  // Always-on customer dots, coloured by dues bucket (web parity). Small radius
  // so the rep markers + check-in pins stay dominant.
  const customerMarkers = useMemo<MapMarker[]>(
    () =>
      customers.map((c) => ({
        lat: c.lat,
        lng: c.lng,
        label: c.name,
        color: bucketColor(c.bucket),
        radius: 6,
      })),
    [customers],
  );

  // The selected rep's visit pins — web colours: green planned / orange unplanned.
  // (A circle, not the web's flag glyph: the installed map build doesn't paint
  // marker `icon` divIcons, so a solid dot is what renders reliably here.) Larger
  // than the customer dots, with the circle's default white halo so they stand out.
  const checkinMarkers = useMemo<MapMarker[]>(
    () =>
      checkins.map((c) => ({
        lat: c.lat,
        lng: c.lng,
        label: c.customerName,
        color: c.planned === "planned" ? CHECKIN_PLANNED : CHECKIN_UNPLANNED,
        radius: 9,
      })),
    [checkins],
  );

  // Draw order = z-order: customers (bottom) → check-ins → reps (top, always tappable).
  const allMarkers = useMemo<MapMarker[]>(
    () => [...customerMarkers, ...checkinMarkers, ...markers],
    [customerMarkers, checkinMarkers, markers],
  );

  // The states the day's activity touches (markers + the selected route) — any
  // Indian state, no hard-coding. Drives which states' boundaries + districts are
  // drawn, so detail appears only where you operate. Empty → all-India outline.
  const operatingStates = useMemo(() => {
    const pts: LatLng[] = [
      ...allMarkers.map((m) => ({ lat: m.lat, lng: m.lng })),
      ...route.map((p) => ({ lat: p.latitude, lng: p.longitude })),
    ];
    return operatingStatesOf(pts);
  }, [allMarkers, route]);

  // Coordinate → data lookups, so a tapped marker resolves to its record.
  const customerByCoord = useMemo(() => {
    const m = new Map<string, MapCustomer>();
    for (const c of customers) m.set(coordKey(c.lat, c.lng), c);
    return m;
  }, [customers]);
  const checkinByCoord = useMemo(() => {
    const m = new Map<string, CheckinMarker>();
    for (const c of checkins) m.set(coordKey(c.lat, c.lng), c);
    return m;
  }, [checkins]);

  // Which tap-card is open (customer or check-in), or none.
  const [card, setCard] = useState<
    { kind: "customer"; data: MapCustomer } | { kind: "checkin"; data: CheckinMarker } | null
  >(null);

  // The route in hand belongs to the selected rep only when it isn't the previous
  // rep's stale placeholder.
  const selectedExec = useMemo(
    () => visible.find((e) => e.userId === selectedId),
    [visible, selectedId],
  );
  const routeReady = !routeStale && route.length > 1;

  const routes = useMemo<MapRoute[]>(() => {
    if (routeReady) {
      return [{
        points: route.map((p) => ({
          lat: p.latitude, lng: p.longitude, label: IST_TIME.format(new Date(p.recordedAt)),
        })),
        color: ROUTE_LINE, weight: 3, opacity: 0.9, showPoints: true,
        pointColor: ROUTE_BEAD, pointRadius: 3.5,
      }];
    }
    // While the selected rep's own route is still loading, a single invisible
    // point at their last-known spot gives the camera an immediate fly target, so
    // the map flies to them at once (then settles onto the trail when it arrives)
    // instead of sitting on the previous rep's route.
    if (selectedExec?.lastLatitude != null && selectedExec.lastLongitude != null) {
      const pt = { lat: selectedExec.lastLatitude, lng: selectedExec.lastLongitude };
      return [{ points: [pt, pt], color: "rgba(0,0,0,0)", weight: 0 }];
    }
    return [];
  }, [routeReady, route, selectedExec]);

  // Fit key. Two stages: `s:<id>` the instant a rep is selected → fly to their
  // last-known spot without waiting for the fetch; `r:<first ping>` once their
  // route loads → fit the whole trail (stable across the 60s polls). With nobody
  // selected, fit to EVERY marker (customers + check-ins + reps) so the map frames
  // the operating area — not just reps: on a day with no tracked reps there are
  // still customer dots, and without this the India-wide map (no region lock) would
  // drift out to a world view. Truly empty → fall back to the India view below.
  let fitKey: string | undefined;
  if (routeReady) fitKey = `r:${route[0]?.recordedAt}`;
  else if (selectedId) fitKey = `s:${selectedId}`;
  else if (allMarkers.length) fitKey = `all:${allMarkers.length}`;
  else fitKey = undefined;

  // Content cross-fade (mirrors the web's framer-motion veil): on each rep change
  // a faint white veil flashes to 0.16 then fades out, smoothing the marker/route
  // swap while the camera flies to the new route. pointer-events off — never
  // blocks the map. Reanimated is the RN twin of framer-motion here.
  const veil = useSharedValue(0);
  useEffect(() => {
    veil.value = withSequence(
      withTiming(0.16, { duration: 0 }),
      withTiming(0, { duration: 550, easing: Easing.out(Easing.cubic) }),
    );
  }, [selectedId, veil]);
  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.value }));

  // Only reveal the map once it's COMPLETELY loaded (every tile/boundary/marker
  // painted — IndiaMapNative's onRenderComplete). The map stays mounted and
  // rendering underneath an opaque loader; when ready, the loader fades out so the
  // finished map fades in. Latched on the first fire (onRenderComplete repeats on
  // re-render).
  const [ready, setReady] = useState(false);
  // Safety net: reveal after 10s even if onRenderComplete never fires (e.g. tiles
  // fail to load offline), so the spinner can't get stuck forever.
  useEffect(() => {
    const id = setTimeout(() => setReady(true), 10_000);
    return () => clearTimeout(id);
  }, []);
  const loaderOpacity = useSharedValue(1);
  useEffect(() => {
    if (ready) loaderOpacity.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.ease) });
  }, [ready, loaderOpacity]);
  const loaderStyle = useAnimatedStyle(() => ({ opacity: loaderOpacity.value }));

  // Dispatch a marker tap. Check-ins sit at customer coordinates, so they're
  // checked FIRST — on a rep's day, their visit pin wins over the base customer
  // dot at the same spot. Then a rep dot selects that rep; else the customer dot.
  const onMarkerTap = (m: MapMarker) => {
    const key = coordKey(m.lat, m.lng);
    const ci = checkinByCoord.get(key);
    if (ci) {
      setCard({ kind: "checkin", data: ci });
      return;
    }
    const ex = visible.find((e) => e.lastLatitude === m.lat && e.lastLongitude === m.lng);
    if (ex) {
      setCard(null);
      setSelectedId(ex.userId);
      return;
    }
    const cu = customerByCoord.get(key);
    if (cu) setCard({ kind: "customer", data: cu });
  };

  const openCustomer = (id: string, name: string) => {
    setCard(null);
    router.push({ pathname: "/customer/[id]", params: { id, name } });
  };

  return (
    <View style={{ flex: 1 }}>
      <IndiaMapNative
        // India-wide: draw boundaries + districts only for the operating states
        // (any state), over the full-India basemap — no region lock, no hard clip.
        // When there's no located data yet, fall back to the all-India state
        // outline (no districts) so the map still has context.
        level={operatingStates.length ? "both" : "state"}
        stateNames={operatingStates.length ? operatingStates : undefined}
        dataKey={operatingStates.join(",")}
        stateStyle={{ color: "#475569", weight: 2 }}
        districtStyle={{ color: "#94a3b8", weight: 0.8, opacity: 0.6 }}
        fitTo="data"
        fitKey={fitKey}
        // India overview when there's no data to fit to (keyless → used as the
        // initial view; any markers/route re-fit over it via fitKey above).
        center={INDIA_CENTER}
        zoom={INDIA_ZOOM}
        markers={allMarkers}
        routes={routes}
        onMarkerClick={onMarkerTap}
        logo={false}
        onRenderComplete={() => setReady(true)}
        style={{ flex: 1 }}
      />
      {/* Cross-fade veil over the map — replays on each rep change (keyed by the
          effect on selectedId), pointer-events off so it never blocks touches. */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.veil, veilStyle]}
      />
      {/* Loading gate: an opaque cover with a spinner over the still-rendering map;
          fades out once the map is fully loaded (blocks touches until then). */}
      <Animated.View
        pointerEvents={ready ? "none" : "auto"}
        style={[StyleSheet.absoluteFill, styles.loader, loaderStyle]}
      >
        <ActivityIndicator color="#3b82f6" />
      </Animated.View>

      {/* Tap-cards for customer / check-in pins — above the map, below nothing. */}
      {card?.kind === "customer" ? (
        <CustomerCard
          customer={card.data}
          bands={bands}
          onClose={() => setCard(null)}
          onOpen={(c) => openCustomer(c.id, c.name)}
        />
      ) : null}
      {card?.kind === "checkin" ? (
        <CheckinCard
          checkin={card.data}
          onClose={() => setCard(null)}
          onOpen={(c) => openCustomer(c.customerId, c.customerName)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  veil: { backgroundColor: "#ffffff" },
  loader: { alignItems: "center", justifyContent: "center", backgroundColor: "#e5e7eb" },
});
