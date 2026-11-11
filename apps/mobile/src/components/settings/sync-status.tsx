import { Pressable, Text, View } from "react-native";
import { kickSync } from "../../lib/sync";
import { type FailedItem } from "../../lib/sync-core";
import { type SyncState } from "../../lib/sync-store";

const ENTITY_LABELS: Record<string, string> = {
  visit_checkin: "Visit check-in",
  visit_checkout: "Visit check-out",
  order: "Order",
  collection: "Collection",
  delivery_start: "Delivery start",
  delivery_stop: "Delivery stop",
  delivery_end: "Delivery end",
  task_done: "Task done",
};

function syncStatusText(sync: SyncState): string {
  if (sync.syncing) return "Syncing…";
  if (sync.pending > 0) {
    return `${sync.pending} item${sync.pending === 1 ? "" : "s"} waiting to sync`;
  }
  return "Everything is synced";
}

/** The "Sync now" quick-action card. */
export function SyncCard({ sync }: { readonly sync: SyncState }) {
  return (
    <View className="rounded-3xl border border-border bg-card p-4">
      <View className="flex-row items-center justify-between">
        <Text className="font-semibold text-card-foreground">Sync</Text>
        <Pressable onPress={() => void kickSync()} hitSlop={8}>
          <Text className="text-sm font-medium text-primary">Sync now</Text>
        </Pressable>
      </View>
      <Text className="mt-2 text-sm text-muted-foreground">{syncStatusText(sync)}</Text>
    </View>
  );
}

/** Inspector listing items that failed to upload, with a retry-all action. */
export function FailedItemsCard({
  failedItems,
  onRetry,
}: {
  readonly failedItems: FailedItem[];
  readonly onRetry: () => void;
}) {
  return (
    <View className="rounded-3xl border border-destructive bg-card p-4">
      <View className="flex-row items-center justify-between">
        <Text className="font-semibold text-destructive">
          {failedItems.length} failed item{failedItems.length === 1 ? "" : "s"}
        </Text>
        <Pressable onPress={onRetry} hitSlop={8}>
          <Text className="text-sm font-medium text-primary">Retry all</Text>
        </Pressable>
      </View>
      {failedItems.map((item) => (
        <View key={item.id} className="mt-3 border-t border-border pt-2">
          <Text className="text-sm font-medium text-card-foreground">
            {ENTITY_LABELS[item.entityType] ?? item.entityType}
          </Text>
          {item.lastError ? (
            <Text className="mt-0.5 text-xs text-muted-foreground">{item.lastError}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}
