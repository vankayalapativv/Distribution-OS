import { Animated, Pressable, Text, View } from "react-native";
import { Icon } from "./icon";
import { TOP_INSET, VARIANT, type Current } from "./toast-core";

/** The presentational snackbar: a severity-coloured card that slides down from
 *  the top. Renders nothing when there is no active toast. Tapping it dismisses. */
export function ToastView({
  current,
  anim,
  onPress,
}: {
  readonly current: Current | null;
  readonly anim: Animated.Value;
  readonly onPress: () => void;
}) {
  if (!current) return null;
  const v = VARIANT[current.variant ?? "info"];
  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: TOP_INSET,
        left: 12,
        right: 12,
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="alert"
        className="flex-row items-start gap-2.5 rounded-xl border bg-white px-4 py-3"
        style={{
          borderColor: v.color,
          shadowColor: "#0f172a",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.12,
          shadowRadius: 8,
          elevation: 4,
        }}
      >
        <Icon name={v.icon} size={18} color={v.color} />
        <View className="flex-1 gap-0.5">
          {current.title ? (
            <Text className="text-sm font-semibold leading-5" style={{ color: v.color }}>
              {current.title}
            </Text>
          ) : null}
          <Text className="text-sm font-medium leading-5 text-foreground">{current.message}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}
