import Ionicons from "@expo/vector-icons/Ionicons";
import type { ColorValue } from "react-native";

/**
 * App icons — monochrome only (Ionicons line set). Replaces the colourful
 * emoji glyphs so every icon renders in a single grey/black colour and takes
 * the surrounding text colour by default.
 */
export type IconName = React.ComponentProps<typeof Ionicons>["name"];

// Default icon colour: the app's foreground (near-black in light mode).
const DEFAULT_COLOR = "#0f172a";

export function Icon({
  name,
  size = 20,
  color = DEFAULT_COLOR,
}: {
  readonly name: IconName;
  readonly size?: number;
  readonly color?: ColorValue;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}
