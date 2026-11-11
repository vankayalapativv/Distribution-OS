import { Text, TextInput, View } from "react-native";

/** ₹ amount input. Partial amounts are allowed. */
export function AmountField({
  value,
  onChange,
  placeholderColor,
}: {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly placeholderColor: string;
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-semibold text-foreground">Amount (₹)</Text>
      <TextInput
        className="rounded-2xl border border-border bg-card px-4 py-3 text-lg font-semibold text-foreground"
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor={placeholderColor}
        value={value}
        onChangeText={onChange}
      />
      <Text className="text-xs text-muted-foreground">Partial amounts are fine.</Text>
    </View>
  );
}
