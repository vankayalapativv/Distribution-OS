/**
 * Selectable date-range preset chips for the ledger. Switching a preset
 * re-slices the already-loaded full statement on-device (no refetch).
 */
import { Pressable, ScrollView, Text } from "react-native";
import { PRESETS, type PresetKey } from "../../lib/ledger-presets";

export function RangePresets({
  preset,
  onSelect,
}: {
  readonly preset: PresetKey;
  readonly onSelect: (p: PresetKey) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="max-h-12 flex-none"
      contentContainerClassName="gap-2 px-5 pb-2"
    >
      {PRESETS.map((p) => {
        const on = p.key === preset;
        return (
          <Pressable
            key={p.key}
            onPress={() => onSelect(p.key)}
            className={`rounded-full border px-3.5 py-2 ${
              on ? "border-primary bg-primary" : "border-border bg-card"
            }`}
          >
            <Text
              className={`text-[13px] font-semibold ${on ? "text-primary-foreground" : "text-secondary-foreground"}`}
            >
              {p.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
