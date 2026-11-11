import { Pressable, Text, View } from "react-native";
import { PAYMENT_MODES } from "../../lib/collection/constants";

/** Cash / Cheque / UPI / NEFT-RTGS chip picker. */
export function ModeChips({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (v: string) => void;
}) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-foreground">Payment mode</Text>
      <View className="flex-row flex-wrap gap-2">
        {PAYMENT_MODES.map((m) => (
          <Pressable
            key={m.key}
            className={`rounded-full border px-4 py-2 ${
              value === m.key ? "border-primary bg-primary" : "border-border bg-card"
            }`}
            onPress={() => onChange(m.key)}
          >
            <Text
              className={`text-sm font-medium ${
                value === m.key ? "text-primary-foreground" : "text-secondary-foreground"
              }`}
            >
              {m.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
