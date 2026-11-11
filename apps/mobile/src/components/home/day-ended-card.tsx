import { Text, View } from "react-native";
import { Icon } from "../icon";

/** Shown in place of the Start-day button once the SE has ended their day. The
 *  day can't be re-started until tomorrow (enforced locally + on the server). */
export function DayEndedCard() {
  return (
    <View className="items-center gap-2 rounded-2xl border border-border bg-card px-5 py-7">
      <View className="h-12 w-12 items-center justify-center rounded-full bg-green-50">
        <Icon name="checkmark-circle" size={28} color="#15803d" />
      </View>
      <Text className="text-base font-bold text-foreground">Day ended</Text>
      <Text className="text-center text-sm text-muted-foreground">Start again tomorrow.</Text>
    </View>
  );
}
