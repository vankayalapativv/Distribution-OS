import { Text, View, type DimensionValue } from "react-native";
import { Skeleton } from "./skeleton";

/**
 * One consistent image-processing / upload shimmer, used wherever a photo is
 * being stamped (watermark compositing) or uploaded to the server — so the
 * tap→preview and the upload gaps are never silent. It fills the photo slot with
 * a shimmering placeholder the SAME shape/size as the real photo (full-width
 * preview for the collection proof, square tiles for photo grids), with an
 * optional caption. Built on the shared `Skeleton` so it matches every other
 * skeleton in the app.
 */
export function PhotoShimmer({
  width = "100%",
  height = 200,
  radius = 24,
  label,
}: {
  readonly width?: DimensionValue;
  readonly height?: number;
  readonly radius?: number;
  /** Optional caption under the shimmer (e.g. "Preparing photo…"). */
  readonly label?: string;
}) {
  return (
    <View style={{ width, gap: 6 }}>
      <Skeleton width={width} height={height} radius={radius} />
      {label ? <Text className="text-xs text-muted-foreground">{label}</Text> : null}
    </View>
  );
}
