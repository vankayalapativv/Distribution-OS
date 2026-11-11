import { Pressable, Text, View } from "react-native";
import { Icon } from "../icon";

/** Big circular "Start day" button — shown only before the day starts. Once the
 *  day is on the caller hides it entirely (no indicator, no empty gap); it
 *  returns the next day on login and after the 8 PM auto-end. */
export function StartDayButton({
  busy,
  onPress,
}: {
  readonly busy: boolean;
  readonly onPress: () => void;
}) {
  return (
    <View className="items-center py-2">
      <Pressable
        className={`h-44 w-44 shadow-lg items-center justify-center rounded-full bg-primary ${
          busy ? "opacity-50" : "active:opacity-90"
        }`}
        style={{
          elevation: 14,
          shadowColor: "#2563eb",
          shadowOffset: { width: 0, height: 14 },
          shadowOpacity: 0.4,
          shadowRadius: 24,
        }}
        onPress={onPress}
        disabled={busy}
      >
        <Icon name="power" size={44} color="#ffffff" />
        <Text className="mt-2 text-lg font-extrabold text-primary-foreground">Start day</Text>
      </Pressable>
    </View>
  );
}
