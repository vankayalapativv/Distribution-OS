import { Pressable, Text, View } from "react-native";
import { claimMoment, claimStatusMeta } from "../../lib/claim-status";
import type { ExpenseClaim } from "../../lib/expense-claims";

/** One claim in the "My expenses" list. Rejected claims surface the reason and
 *  invite a tap to fix + resubmit. */
export function ClaimRow({ claim, onPress }: { readonly claim: ExpenseClaim; readonly onPress: (c: ExpenseClaim) => void }) {
  const meta = claimStatusMeta(claim.status);
  const reduced = claim.status === "approved" && claim.amount < claim.claimedAmount;
  return (
    <Pressable className="border-t border-border px-4 py-3 active:bg-secondary" onPress={() => onPress(claim)}>
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 text-base font-semibold text-card-foreground" numberOfLines={1}>
          {claim.categoryName}
        </Text>
        <Text className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${meta.chip}`}>{meta.label}</Text>
      </View>
      <View className="mt-0.5 flex-row items-center justify-between">
        <Text className="text-xs text-muted-foreground">{claimMoment(claim.createdAt)}</Text>
        <Text className="text-sm font-bold text-card-foreground">
          ₹{claim.amount.toLocaleString("en-IN")}
          {reduced ? (
            <Text className="text-xs font-normal text-muted-foreground"> of ₹{claim.claimedAmount.toLocaleString("en-IN")}</Text>
          ) : null}
        </Text>
      </View>
      {claim.status === "rejected" && claim.rejectReason ? (
        <Text className="mt-1 text-xs text-red-600">Rejected: {claim.rejectReason} · tap to fix</Text>
      ) : null}
      {claim.status === "submitted" ? (
        <Text className="mt-1 text-xs text-muted-foreground">Tap to edit while it&apos;s pending</Text>
      ) : null}
    </Pressable>
  );
}
