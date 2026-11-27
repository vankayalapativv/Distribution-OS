import { Tabs } from "expo-router";
import { type ColorValue, type PressableProps } from "react-native";
import { Icon } from "../../components/icon";
import { SpringTabButton } from "../../components/tabs/spring-tab-button";

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
const StockTabIcon = ({ color, focused }: TabIconProps) => (
  <Icon name={focused ? "cube" : "cube-outline"} color={color} size={22} />
);
const SettingsTabIcon = ({ color, focused }: TabIconProps) => (
  <Icon name={focused ? "settings" : "settings-outline"} color={color} size={22} />
);
const TabBarButton = (props: PressableProps) => <SpringTabButton {...props} />;

/** Super Admin tab layout: Home (KPIs) · Customers · Tracking · Alerts · Stock · Settings. */
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
        name="stock"
        options={{
          title: "Stock",
          tabBarIcon: StockTabIcon,
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
