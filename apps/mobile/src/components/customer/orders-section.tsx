import type { UseQueryResult } from "@tanstack/react-query";
import { Pressable, Text, View } from "react-native";
import { formatStatus } from "../../lib/format";
import type { ServerOrder } from "../../lib/customer/types";
import { ErrorState } from "../error-state";
import { RecordRowSkeleton, SkeletonList } from "../skeleton";
import { FULFILLMENT_LABEL, SectionTitle, STATUS_CHIP } from "./section-bits";

/** Last 5 orders — code + fulfillment badge + date/litres; tap opens the sheet. */
export function OrdersSection({
  query,
  onOpen,
}: {
  readonly query: UseQueryResult<ServerOrder[]>;
  readonly onOpen: (o: ServerOrder) => void;
}) {
  const orders = query.data ?? [];
  return (
    <View className="gap-2">
      <SectionTitle>Last 5 orders</SectionTitle>
      {(() => { if (query.isPending) return (
        <SkeletonList count={3} row={RecordRowSkeleton} />
      ); if (query.isError) return (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} compact />
      ); if (orders.length === 0) return (
        <Text className="py-6 text-center text-sm text-muted-foreground">No orders recorded yet.</Text>
      ); return (
        orders.map((o) => {
          const fs = o.fulfillmentStatus ?? "ordered";
          return (
            <Pressable
              key={o.id}
              className="rounded-3xl border border-border bg-card p-3 active:opacity-70"
              onPress={() => onOpen(o)}
            >
              <View className="flex-row items-center justify-between">
                <Text className="font-semibold text-card-foreground">{o.orderCode}</Text>
                <Text
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CHIP[fs] ?? "bg-muted text-muted-foreground"}`}
                >
                  {FULFILLMENT_LABEL[fs] ?? formatStatus(fs)}
                </Text>
              </View>
              <Text className="mt-1 text-xs text-muted-foreground">
                {o.orderDate?.slice(0, 10)} · {o.totalLitres ?? 0} L
              </Text>
            </Pressable>
          );
        })
      ); })()}
    </View>
  );
}
