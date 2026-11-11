import { useRef } from "react";
import {
  Animated,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
} from "react-native";

/**
 * Tab button with a scale-down spring on press (decided 2026-07-12) —
 * the whole tab (icon + label) shrinks ~10% while held and springs back.
 */
export function SpringTabButton({ children, onPressIn, onPressOut, style, ...rest }: Readonly<PressableProps>) {
  const scale = useRef(new Animated.Value(1)).current;

  function springTo(toValue: number) {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 40,
      bounciness: 10,
    }).start();
  }

  return (
    <Pressable
      {...rest}
      style={[{ flex: 1 }, typeof style === "object" ? style : null]}
      android_ripple={undefined}
      onPressIn={(event: GestureResponderEvent) => {
        springTo(0.88);
        onPressIn?.(event);
      }}
      onPressOut={(event: GestureResponderEvent) => {
        springTo(1);
        onPressOut?.(event);
      }}
    >
      <Animated.View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          transform: [{ scale }],
        }}
      >
        {children as React.ReactNode}
      </Animated.View>
    </Pressable>
  );
}
