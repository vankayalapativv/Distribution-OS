import { Pressable, Text, View } from "react-native";
import { Icon } from "../icon";
import type { Chip } from "../../lib/tracking-overlays";

/** A small coloured chip (order / collection recency). */
export function Pill({ chip }: { readonly chip: Chip }) {
  return (
    <View className="self-start rounded-full px-2 py-0.5" style={{ backgroundColor: chip.bg }}>
      <Text className="text-[11px] font-semibold" style={{ color: chip.fg }}>
        {chip.label}
      </Text>
    </View>
  );
}

/** The bottom-sheet card frame shared by the map's customer and check-in cards. */
export function CardShell({
  children,
  onClose,
}: {
  readonly children: React.ReactNode;
  readonly onClose: () => void;
}) {
  return (
    <View
      className="absolute inset-x-0 bottom-0 gap-2 rounded-t-3xl border-t border-border bg-card px-5 pb-6 pt-3"
      style={{ shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 12 }}
    >
      <View className="mb-1 h-1 w-9 self-center rounded-full bg-border" />
      <Pressable onPress={onClose} hitSlop={10} className="absolute right-4 top-4">
        <Icon name="close" size={22} color="#64748b" />
      </Pressable>
      {children}
    </View>
  );
}
