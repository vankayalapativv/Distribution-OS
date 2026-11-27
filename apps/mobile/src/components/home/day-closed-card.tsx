import { Text, View } from "react-native";
import { Icon } from "../icon";

/** Shown in place of the Start-day button when a Sales Executive opens Home after
 *  the fixed 8 PM auto-stop. Tracking is closed for the day (enforced on device +
 *  server) and can't be started again until tomorrow. */
export function DayClosedCard() {
  return (
    <View className="items-center gap-2 rounded-2xl border border-border bg-card px-5 py-7">
      <View className="h-12 w-12 items-center justify-center rounded-full bg-amber-50">
        <Icon name="moon" size={26} color="#b45309" />
      </View>
      <Text className="text-base font-bold text-foreground">Tracking closed for today</Text>
      <Text className="text-center text-sm text-muted-foreground">
        Tracking stops for the day at 8 PM. Start again tomorrow morning.
      </Text>
    </View>
  );
}
