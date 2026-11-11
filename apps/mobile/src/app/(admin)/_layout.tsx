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

/** Tab button with a scale-down spring on press — same feel as the SE/Logistics apps. */
function SpringTabButton({ children, onPressIn, onPressOut, style, ...rest }: Readonly<PressableProps>) {
  const scale = useRef(new Animated.Value(1)).current;
  function springTo(toValue: number) {
    Animated.spring(scale, { toValue, useNativeDriver: true, speed: 40, bounciness: 10 }).start();
  }
  return (
    <Pressable
      {...rest}
      style={[{ flex: 1 }, typeof style === "object" ? style : null]}
      android_ripple={undefined}
      onPressIn={(e: GestureResponderEvent) => {
        springTo(0.88);
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        springTo(1);
        onPressOut?.(e);
      }}
    >
      <Animated.View
        style={{ flex: 1, alignItems: "center", justifyContent: "center", transform: [{ scale }] }}
      >
        {children as React.ReactNode}
      </Animated.View>
    </Pressable>
  );
}

// Module-scope so the navigator gets stable component references (SonarQube S6478).
type TabIconProps = { readonly color: ColorValue; readonly focused: boolean };
const HomeTabIcon = ({ color, focused }: TabIconProps) => (
  <Icon name={focused ? "home" : "home-outline"} color={color} size={22} />
);
const CustomersTabIcon = ({ color, focused }: TabIconProps) => (
  <Icon name={focused ? "people" : "people-outline"} color={color} size={22} />
);
const TrackingTabIcon = ({ color, focused }: TabIconProps) => (
  <Icon name={focused ? "map" : "map-outline"} color={color} size={22} />
);
const AlertsTabIcon = ({ color, focused }: TabIconProps) => (
  <Icon name={focused ? "notifications" : "notifications-outline"} color={color} size={22} />
);
const SettingsTabIcon = ({ color, focused }: TabIconProps) => (
  <Icon name={focused ? "settings" : "settings-outline"} color={color} size={22} />
);
const TabBarButton = (props: PressableProps) => <SpringTabButton {...props} />;

/** Super Admin tab layout: Home (KPIs) · Customers · Tracking · Alerts · Settings. */
export default function AdminLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#3b82f6",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarButton: TabBarButton,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: HomeTabIcon,
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: "Customers",
          tabBarIcon: CustomersTabIcon,
        }}
      />
      <Tabs.Screen
        name="tracking"
        options={{
          title: "Tracking",
          tabBarIcon: TrackingTabIcon,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: "Alerts",
          tabBarIcon: AlertsTabIcon,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: SettingsTabIcon,
        }}
      />
      {/* Pushed screen (from the Home dues card), not a tab. */}
      <Tabs.Screen name="dues" options={{ href: null }} />
    </Tabs>
  );
}
