import { Pressable, Text, TextInput, View } from "react-native";
import { parseQty } from "../../lib/order/types";

function borderClass(n: number | null, compact: boolean): string {
  if (n === null) return "border-b-2 border-destructive";
  return compact ? "border-b border-border" : "border-b-2 border-primary";
}

/** Typed quantity with round −/＋ steppers. Value is the raw text (≥ 1 valid). */
export function QtyField({
  value,
  onChange,
  compact = false,
}: {
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly compact?: boolean;
}) {
  const n = parseQty(value);
  function step(direction: 1 | -1) {
    onChange(String(Math.max(1, (n ?? 1) + direction)));
  }
  const btn = compact ? "h-8 w-8" : "h-11 w-11";
  const btnText = compact ? "text-base" : "text-xl";
  const field = compact
    ? "w-12 pb-0.5 text-center text-sm font-bold"
    : "flex-1 pb-1 text-center text-2xl font-bold";
  return (
    <View className={`flex-row items-center ${compact ? "gap-1.5" : "gap-3"}`}>
      <Pressable
        className={`${btn} items-center justify-center rounded-full border border-border`}
        onPress={() => step(-1)}
      >
        <Text className={`${btnText} text-primary`}>−</Text>
      </Pressable>
      <TextInput
        className={`${field} text-foreground ${borderClass(n, compact)}`}
        keyboardType="number-pad"
        value={value}
        onChangeText={onChange}
        selectTextOnFocus
      />
      <Pressable
        className={`${btn} items-center justify-center rounded-full border border-border`}
        onPress={() => step(1)}
      >
        <Text className={`${btnText} text-primary`}>＋</Text>
      </Pressable>
    </View>
  );
}
