import { Pressable, Text, View } from "react-native";
import { Icon } from "./icon";

/** A vertical up/down stepper for one time field (hour or minute). */
export function Stepper({
  value,
  onUp,
  onDown,
}: {
  readonly value: string;
  readonly onUp: () => void;
  readonly onDown: () => void;
}) {
  return (
    <View className="items-center">
      <Pressable onPress={onUp} hitSlop={8} className="h-8 w-12 items-center justify-center">
        <Icon name="chevron-up" size={20} color="#334155" />
      </Pressable>
      <Text className="w-14 text-center text-2xl font-bold text-foreground">{value}</Text>
      <Pressable onPress={onDown} hitSlop={8} className="h-8 w-12 items-center justify-center">
        <Icon name="chevron-down" size={20} color="#334155" />
      </Pressable>
    </View>
  );
}
