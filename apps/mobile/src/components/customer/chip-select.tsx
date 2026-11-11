import { Pressable, Text, View } from "react-native";

/**
 * Labelled row of pill chips. Single- or multi-select is decided by the caller
 * via `isOn` / `onToggle` — the chip only reflects and reports taps.
 */
export function ChipSelect({
  label,
  required,
  error,
  options,
  isOn,
  onToggle,
}: {
  readonly label: string;
  readonly required?: boolean;
  readonly error?: string | null;
  readonly options: readonly { value: string; label: string }[];
  readonly isOn: (value: string) => boolean;
  readonly onToggle: (value: string) => void;
}) {
  return (
    <View className="gap-1">
      <Text className="text-sm font-medium text-foreground">
        {label}
        {required ? <Text className="text-destructive"> *</Text> : null}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((o) => {
          const on = isOn(o.value);
          return (
            <Pressable
              key={o.value}
              className={`rounded-full px-4 py-2 ${on ? "bg-primary" : "bg-secondary"}`}
              onPress={() => onToggle(o.value)}
            >
              <Text
                className={`text-sm font-medium ${
                  on ? "text-primary-foreground" : "text-secondary-foreground"
                }`}
              >
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text className="text-xs text-destructive">{error}</Text> : null}
    </View>
  );
}
