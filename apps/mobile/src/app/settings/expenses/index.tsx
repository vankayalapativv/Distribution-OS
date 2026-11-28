import { router } from "expo-router";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ClaimRow } from "../../../components/expenses/claim-row";
import { OwedCard } from "../../../components/expenses/owed-card";
import { ClaimRowSkeleton, SkeletonList } from "../../../components/skeleton";
import { ErrorState } from "../../../components/error-state";
import { useMyClaims } from "../../../lib/use-my-claims";
import { useMyReimbursements } from "../../../lib/use-my-reimbursements";
import { usePullRefresh } from "../../../lib/use-pull-refresh";
import type { ExpenseClaim } from "../../../lib/expense-claims";

/** My expenses — submit expense claims and track approval (online-only). Salary
 *  and advances live on the web only; the field app shows expenses alone. */
export default function MyExpensesScreen() {
  const { claims, loading, error, retry } = useMyClaims();
  const { owedTotal, refetch: refetchOwed } = useMyReimbursements();
  // Pull-to-refresh updates the claims and the "owed to you" total together.
  const { refreshing, onRefresh } = usePullRefresh(() => Promise.all([retry(), refetchOwed()]));

  function openClaim(claim: ExpenseClaim) {
    // Only a rejected claim is editable → reopen the form to fix + resubmit.
    if (claim.status === "rejected") {
      router.push({ pathname: "/settings/expenses/new", params: { id: claim.id } });
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-row items-center justify-between gap-3 border-b border-border px-5 py-4">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text className="text-2xl text-foreground">‹</Text>
          </Pressable>
          <Text className="text-xl font-bold text-foreground">My expenses</Text>
        </View>
        <Pressable className="rounded-full bg-primary px-4 py-2" onPress={() => router.push("/settings/expenses/new")}>
          <Text className="text-sm font-semibold text-primary-foreground">＋ New</Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 p-4">
          <SkeletonList count={5} row={ClaimRowSkeleton} />
        </View>
      ) : error ? (
        <ErrorState error={error} onRetry={retry} />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="p-4"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <OwedCard owedTotal={owedTotal} />
          {claims.length === 0 ? (
            <View className="items-center gap-2 py-16">
              <Text className="text-base font-semibold text-foreground">No claims yet</Text>
              <Text className="px-8 text-center text-sm text-muted-foreground">
                Spent your own money on the field? Submit the bill here and get it reimbursed after approval.
              </Text>
            </View>
          ) : (
            <View className="overflow-hidden rounded-3xl border border-border bg-card">
              {claims.map((claim) => (
                <ClaimRow key={claim.id} claim={claim} onPress={openClaim} />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
