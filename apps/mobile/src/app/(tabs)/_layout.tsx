import { Tabs } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppState, type ColorValue, type PressableProps } from "react-native";
import { Icon } from "../../components/icon";
import { SpringTabButton } from "../../components/tabs/spring-tab-button";
import { getLocalDb } from "../../lib/db";
import { pendingFollowupCount } from "../../lib/customer/followups";
import { NOTIFICATIONS_KEY, unreadCount, useNotificationsQuery } from "../../lib/notifications-query";

function badgeCount(unread: number): string | number | undefined {
  if (unread <= 0) return undefined;
  return unread > 99 ? "99+" : unread;
}

/** Count of open customer follow-up reminders — the Reminders tab badge. Polls
 *  the local store (cheap) and refreshes on foreground, mirroring the Alerts
 *  badge so a set/resolved follow-up updates the count within a few seconds. */
function usePendingFollowups(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const read = () => {
      const db = getLocalDb();
      if (db) setN(pendingFollowupCount(db));
    };
    read();
    const id = setInterval(read, 8000);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") read();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, []);
  return n;
}

// Module-scope so the navigator gets a stable component reference (not a new
// component defined on every render — SonarQube S6478 / unstable nested components).
type TabIconProps = { readonly color: ColorValue; readonly focused: boolean };
const HomeTabIcon = ({ color, focused }: TabIconProps) => (
  <Icon name={focused ? "home" : "home-outline"} color={color} size={22} />
);
const CustomersTabIcon = ({ color, focused }: TabIconProps) => (
  <Icon name={focused ? "people" : "people-outline"} color={color} size={22} />
);
const AlertsTabIcon = ({ color, focused }: TabIconProps) => (
  <Icon name={focused ? "notifications" : "notifications-outline"} color={color} size={22} />
);
const RemindersTabIcon = ({ color, focused }: TabIconProps) => (
  <Icon name={focused ? "alarm" : "alarm-outline"} color={color} size={22} />
);
const SettingsTabIcon = ({ color, focused }: TabIconProps) => (
  <Icon name={focused ? "settings" : "settings-outline"} color={color} size={22} />
);
const TabBarButton = (props: PressableProps) => <SpringTabButton {...props} />;

export default function TabsLayout() {
  // Shared notifications feed — same cache the Alerts screen reads. Fetches on
  // mount and polls every 60s on its own; the badge is just the unread count.
  const query = useNotificationsQuery();
  const unread = unreadCount(query.data);
  const qc = useQueryClient();

  // Also refetch when the app returns to the foreground so the badge is current
  // on resume (the interval is paused while backgrounded).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void qc.refetchQueries({ queryKey: NOTIFICATIONS_KEY });
    });
    return () => sub.remove();
  }, [qc]);

  // Reminders tab badge: count of open customer follow-ups (hidden at 0).
  const followups = usePendingFollowups();
  let followupBadge: string | number | undefined;
  if (followups > 99) followupBadge = "99+";
  else if (followups > 0) followupBadge = followups;

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
        name="alerts"
        options={{
          title: "Alerts",
          tabBarBadge: badgeCount(unread),
          tabBarBadgeStyle: { backgroundColor: "#ef4444", fontSize: 10 },
          tabBarIcon: AlertsTabIcon,
        }}
      />
      <Tabs.Screen
        name="reminders"
        options={{
          title: "Reminders",
          tabBarBadge: followupBadge,
          tabBarBadgeStyle: { backgroundColor: "#ef4444", fontSize: 10 },
          tabBarIcon: RemindersTabIcon,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: SettingsTabIcon,
        }}
      />
    </Tabs>
  );
}
