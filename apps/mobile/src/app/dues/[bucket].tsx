/**
 * Dues bucket drill-down: the SE's customers inside one ageing bucket,
 * oldest first, each tappable through to that customer's ledger.
 */
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DuesCustomerRow } from "../../components/dues/dues-customer-row";
import { ErrorState } from "../../components/error-state";
import { DuesRowSkeleton, SkeletonList } from "../../components/skeleton";
import { fetchDuesCustomers, type DuesBucketKey, type DuesCustomer } from "../../lib/dues";

const BUCKET_TITLES: Record<DuesBucketKey, string> = {
  "0_30": "Dues · 0–30 days",
  "30_45": "Dues · 31–45 days",
  "45_60": "Dues · 46–60 days",
  "60_plus": "Dues · 61+ days",
};

export default function DuesBucketScreen() {
  const params = useLocalSearchParams<{ bucket: string }>();
  const bucket = (params.bucket ?? "0_30") as DuesBucketKey;
  const [customers, setCustomers] = useState<DuesCustomer[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchDuesCustomers(bucket).then((result) => {
      if (cancelled) return;
      if (!result) {
        setFailed(true);
        setCustomers([]);
        return;
      }
      setCustomers(result.customers);
    });
    return () => {
      cancelled = true;
    };
  }, [bucket]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-5 py-4">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text className="text-2xl text-foreground">←</Text>
        </Pressable>
        <Text className="text-xl font-bold text-foreground">
          {BUCKET_TITLES[bucket] ?? "Dues"}
        </Text>
      </View>

      {customers === null ? (
        <View className="gap-2 px-4 pt-1">
          <SkeletonList count={6} row={DuesRowSkeleton} />
        </View>
      ) : (
        <FlatList
          className="flex-1"
          contentContainerClassName="gap-2 px-4 pb-6"
          data={customers}
          keyExtractor={(c) => c.customerId}
          renderItem={({ item: customer }) => <DuesCustomerRow customer={customer} />}
          ListEmptyComponent={
            failed ? (
              <ErrorState error={undefined} compact />
            ) : (
              <View className="items-center gap-1 rounded-xl border border-border bg-card px-4 py-8">
                <Text className="text-sm font-medium text-card-foreground">
                  No customers in this bucket
                </Text>
              </View>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}
