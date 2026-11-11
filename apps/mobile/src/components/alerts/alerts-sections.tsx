import { FlatList, RefreshControl } from "react-native";
import type { InvoiceNotification } from "../../lib/invoice-notifications";
import { NotificationRowSkeleton, SkeletonList } from "../skeleton";
import { EmptyState } from "./empty-state";
import { NotificationCard } from "./notification-card";
import { buildTabConfig } from "./alerts-tab-config";

/** The active SE Alerts segment (Collections Due / New Invoices / Deliveries) as
 *  ONE virtualized list. Switching `tab` swaps the data (both arrays are already
 *  in memory, so it's instant) — a single FlatList replaces the old three
 *  always-mounted sections wrapped in a ScrollView (which mounted every card and
 *  couldn't virtualize). Skeleton / empty share the ListEmptyComponent slot. */
export function AlertsSections({
  tab,
  loading,
  dues,
  invoices,
  deliveries,
  refreshing,
  onRefresh,
  onDues,
  onOpen,
  markRead,
  deleteOne,
}: {
  readonly tab: "dues" | "invoice" | "delivery";
  readonly loading: boolean;
  readonly dues: InvoiceNotification[];
  readonly invoices: InvoiceNotification[];
  readonly deliveries: InvoiceNotification[];
  readonly refreshing: boolean;
  readonly onRefresh: () => void;
  readonly onDues: (n: InvoiceNotification) => void;
  readonly onOpen: (n: InvoiceNotification) => void;
  readonly markRead: (n: InvoiceNotification) => void;
  readonly deleteOne: (id: string) => void;
}) {
  const c = buildTabConfig({ dues, invoices, deliveries, onDues, onOpen, markRead })[tab];

  return (
    <FlatList
      className="flex-1"
      contentContainerClassName="gap-2 px-4 py-3"
      data={loading ? [] : c.items}
      keyExtractor={(n) => n.id}
      renderItem={({ item }) => (
        <NotificationCard
          n={item}
          accent={c.accent}
          trailing={c.trailing(item)}
          onPress={() => c.onPress(item)}
          onDelete={deleteOne}
        />
      )}
      ListEmptyComponent={
        loading ? (
          <SkeletonList count={c.skeletonCount} row={NotificationRowSkeleton} />
        ) : (
          <EmptyState title={c.emptyTitle} body={c.emptyBody} />
        )
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    />
  );
}
