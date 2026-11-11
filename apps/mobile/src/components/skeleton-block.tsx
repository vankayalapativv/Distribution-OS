/**
 * A single shimmer block — the gray primitive every skeleton row is built
 * from. A skewed translucent band sweeps across it, driven by the shared
 * loop (no gradient dependency, so no native rebuild).
 */
import { Animated, View, type DimensionValue } from "react-native";
import { useSweep } from "./skeleton-sweep";

const SKELETON_BG = "#e5e7eb"; // --border / gray-200 from the shared theme

export function Skeleton({
  width = "100%",
  height = 14,
  radius = 6,
  style,
}: {
  readonly width?: DimensionValue;
  readonly height?: number;
  readonly radius?: number;
  readonly style?: object;
}) {
  const sweep = useSweep();
  // The band travels well past both edges so wide and narrow blocks all
  // read as one continuous sweep.
  const translateX = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [-320, 320],
  });
  return (
    <View
      style={[
        { width, height, borderRadius: radius, backgroundColor: SKELETON_BG, overflow: "hidden" },
        style,
      ]}
    >
      <Animated.View
        style={{
          position: "absolute",
          top: -10,
          bottom: -10,
          width: 88,
          transform: [{ translateX }, { skewX: "-18deg" }],
        }}
      >
        {/* Three stacked strips fake a soft gradient edge without a native
            gradient module. */}
        <View style={{ flex: 1, flexDirection: "row" }}>
          <View style={{ width: 24, backgroundColor: "rgba(255,255,255,0.22)" }} />
          <View style={{ width: 40, backgroundColor: "rgba(255,255,255,0.5)" }} />
          <View style={{ width: 24, backgroundColor: "rgba(255,255,255,0.22)" }} />
        </View>
      </Animated.View>
    </View>
  );
}
