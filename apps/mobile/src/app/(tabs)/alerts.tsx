import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AlertsSections } from "../../components/alerts/alerts-sections";
import { ToggleButton } from "../../components/alerts/toggle-button";
import type { InvoiceNotification } from "../../lib/invoice-notifications";
import { useSeAlerts } from "../../lib/use-se-alerts";

/**
 * Alerts tab: the SE's inbox — accountant-uploaded invoices for this SE's
 * customers (viewable/shareable to WhatsApp), the dues-bucket crossing feed,
 * and delivery events. Online-only: the feed is always refetched from
 * /me/notifications (no offline sync).
 */
export default function AlertsScreen() {
  const a = useSeAlerts();
  // Which segment is shown. Defaults to Collections Due (most action-oriented).
  const [tab, setTab] = useState<"dues" | "invoice" | "delivery">("dues");

  useFocusEffect(useCallback(() => a.reload(), [a.reload]));

  const loading = a.notifications === null;
  const all = a.notifications ?? [];
  const invoices = all.filter((n) => n.type === "invoice");
  const deliveries = all.filter((n) => n.type === "delivery");
  const dues = all.filter((n) => n.type === "dues_bucket");
  const unread = (list: InvoiceNotification[]) => list.filter((n) => !n.readAt).length;

  return (
    <SafeAreaView className="flex-1 bg-secondary" edges={["top"]}>
      <View className="flex-row items-center justify-between border-b border-border px-5 py-4">
        <Text className="text-xl font-bold text-foreground">Alerts</Text>
        {all.length > 0 ? (
          <Pressable hitSlop={8} onPress={() => void a.clearAll()}>
            <Text className="text-sm font-semibold text-destructive">Clear all</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Segmented toggle: Collections Due · New Invoices · Deliveries. */}
      <View className="mx-4 mt-3 flex-row rounded-xl bg-secondary p-1">
        <ToggleButton label="Collections Due" on={tab === "dues"} count={unread(dues)} onPress={() => setTab("dues")} />
        <ToggleButton label="New Invoices" on={tab === "invoice"} count={unread(invoices)} onPress={() => setTab("invoice")} />
        <ToggleButton label="Deliveries" on={tab === "delivery"} count={unread(deliveries)} onPress={() => setTab("delivery")} />
      </View>

      <AlertsSections
        tab={tab}
        loading={loading}
        dues={dues}
        invoices={invoices}
        deliveries={deliveries}
        refreshing={a.refreshing}
        onRefresh={a.onRefresh}
        onDues={a.onDues}
        onOpen={a.onOpen}
        markRead={a.markRead}
        deleteOne={a.deleteOne}
      />
    </SafeAreaView>
  );
}
