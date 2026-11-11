import { Pressable, Text, View } from "react-native";

/** One segment button in the SE Alerts top toggle: label + optional
 *  unread-count badge. */
export function ToggleButton({
  label,
  on,
  count,
  onPress,
}: {
  readonly label: string;
  readonly on: boolean;
  readonly count: number;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 flex-row items-center justify-center gap-1 rounded-lg px-1.5 py-2 ${
        on ? "bg-card" : ""
      }`}
    >
      <Text
        numberOfLines={1}
        className={`text-[11px] font-semibold ${on ? "text-card-foreground" : "text-muted-foreground"}`}
      >
        {label}
      </Text>
      {count > 0 ? (
        <View className="min-w-[16px] items-center rounded-full bg-red-500 px-1">
          <Text className="text-[10px] font-bold text-white">{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
