import { Tabs } from "expo-router";
import { type ColorValue, type PressableProps } from "react-native";
import { Icon } from "../../components/icon";
import { SpringTabButton } from "../../components/tabs/spring-tab-button";

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
