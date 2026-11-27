import { ActivityIndicator, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { IndiaMapNative } from "vardhan-maps/react-native";
import type { CheckinMarker, DuesBand, MapCustomer, RoutePoint, TrackedExecutive } from "../../lib/admin-tracking";
import { CheckinCard, CustomerCard } from "./tracking-map-cards";
import { INDIA_CENTER, INDIA_ZOOM } from "./tracking-map-model";
import { useTrackingMap } from "./use-tracking-map";

/** SA tracking map on the self-hosted OSM vector basemap (vardhan-maps RN):
 *  rep markers (green live / grey stale) + the selected rep's route with a red
 *  dot per ping. Fits to the selected route; tap-cards for customer/check-in pins. */
export function TrackingMap(props: {
  readonly visible: TrackedExecutive[];
  readonly customers: MapCustomer[];
  readonly bands: DuesBand[];
  readonly checkins: CheckinMarker[];
  readonly route: RoutePoint[];
  readonly routeStale?: boolean;
  readonly selectedId: string | null;
  readonly setSelectedId: (id: string) => void;
}) {
  const m = useTrackingMap(props);

  return (
    <View style={{ flex: 1 }}>
      <IndiaMapNative
        level={m.operatingStates.length ? "both" : "state"}
        stateNames={m.operatingStates.length ? m.operatingStates : undefined}
        dataKey={m.operatingStates.join(",")}
        stateStyle={{ color: "#475569", weight: 2 }}
        districtStyle={{ color: "#94a3b8", weight: 0.8, opacity: 0.6 }}
        fitTo="data"
        fitKey={m.fitKey}
        center={INDIA_CENTER}
        zoom={INDIA_ZOOM}
        markers={m.allMarkers}
        routes={m.routes}
        onMarkerClick={m.onMarkerTap}
        logo={false}
        onRenderComplete={() => m.setReady(true)}
        style={{ flex: 1 }}
      />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.veil, m.veilStyle]} />
      <Animated.View
        pointerEvents={m.ready ? "none" : "auto"}
        style={[StyleSheet.absoluteFill, styles.loader, m.loaderStyle]}
      >
        <ActivityIndicator color="#3b82f6" />
      </Animated.View>

      {m.card?.kind === "customer" ? (
        <CustomerCard
          customer={m.card.data}
          bands={props.bands}
          onClose={() => m.setCard(null)}
          onOpen={(c) => m.openCustomer(c.id, c.name)}
        />
      ) : null}
      {m.card?.kind === "checkin" ? (
        <CheckinCard
          checkin={m.card.data}
          onClose={() => m.setCard(null)}
          onOpen={(c) => m.openCustomer(c.customerId, c.customerName)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  veil: { backgroundColor: "#ffffff" },
  loader: { alignItems: "center", justifyContent: "center", backgroundColor: "#e5e7eb" },
});
