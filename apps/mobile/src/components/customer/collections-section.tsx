import type { UseQueryResult } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { formatPaymentMode, formatStatus } from "../../lib/format";
import type { ServerCollection } from "../../lib/customer/types";
import { ErrorState } from "../error-state";
import { RecordRowSkeleton, SkeletonList } from "../skeleton";
import { SectionTitle, STATUS_CHIP } from "./section-bits";

/** Last 5 collections — amount + mode + accountant status. */
export function CollectionsSection({ query }: { readonly query: UseQueryResult<ServerCollection[]> }) {
  const collections = query.data ?? [];
  return (
    <View className="gap-2">
      <SectionTitle>Last 5 collections</SectionTitle>
      {(() => { if (query.isPending) return (
        <SkeletonList count={3} row={RecordRowSkeleton} />
      ); if (query.isError) return (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} compact />
      ); if (collections.length === 0) return (
        <Text className="py-6 text-center text-sm text-muted-foreground">
          No collections recorded yet.
        </Text>
      ); return (
        collections.map((col) => (
          <View key={col.id} className="rounded-3xl border border-border bg-card p-3">
            <View className="flex-row items-center justify-between">
              <Text className="font-semibold text-card-foreground">
                ₹{Number(col.collectionAmount).toLocaleString("en-IN")} · {formatPaymentMode(col.paymentMode)}
              </Text>
              <Text
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CHIP[col.accountantApprovalStatus] ?? "bg-muted text-muted-foreground"}`}
              >
                {formatStatus(col.accountantApprovalStatus)}
              </Text>
            </View>
            <Text className="mt-1 text-xs text-muted-foreground">
              {col.collectionCode} · {col.collectionDate?.slice(0, 10)}
            </Text>
          </View>
        ))
      ); })()}
    </View>
  );
}
