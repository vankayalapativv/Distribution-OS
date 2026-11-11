import { Tabs } from "expo-router";
import { useRef } from "react";
import {
  Animated,
  Pressable,
  type ColorValue,
  type GestureResponderEvent,
  type PressableProps,
} from "react-native";
import { Icon } from "../../components/icon";

/**
 * Tab button with a scale-down spring on press — the whole tab (icon + label)
 * shrinks ~12% while held and springs back. Same feel as the SE app.
 */
function SpringTabButton({ children, onPressIn, onPressOut, style, ...rest }: Readonly<PressableProps>) {
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

// Module-scope so the navigator gets stable component references (SonarQube S6478).
type TabIconProps = { readonly color: ColorValue; readonly focused: boolean };
const DeliveryTabIcon = ({ color, focused }: TabIconProps) => (
  <Icon name={focused ? "cube" : "cube-outline"} color={color} size={22} />
);
const SettingsTabIcon = ({ color, focused }: TabIconProps) => (
  <Icon name={focused ? "settings" : "settings-outline"} color={color} size={22} />
);
const TabBarButton = (props: PressableProps) => <SpringTabButton {...props} />;

/** Logistics tab layout: Delivery + Settings (same Settings as the SE app). */
export default function LogisticsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Black & white only: dark for active, grey for inactive.
        tabBarActiveTintColor: "#3b82f6",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarButton: TabBarButton,
      }}
    >
      <Tabs.Screen
        name="delivery"
        options={{
          title: "Delivery",
          tabBarIcon: DeliveryTabIcon,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: SettingsTabIcon,
        }}
      />
      {/* Pushed screen, not a tab. */}
      <Tabs.Screen name="add-delivery" options={{ href: null }} />
    </Tabs>
  );
}
