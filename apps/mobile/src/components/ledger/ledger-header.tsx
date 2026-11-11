/**
 * Ledger screen header: back button + customer name, and a prominent CLOSING
 * BALANCE (Dr orange / Cr green). While the statement loads, the balance number
 * shows a small shimmer but the header container stays rendered.
 */
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Skeleton } from "../skeleton";
import { balanceLabel } from "../../lib/ledger-format";

export function LedgerHeader({
  customerName,
  closingBalance,
  pending,
}: {
  readonly customerName: string;
  readonly closingBalance: number;
  readonly pending: boolean;
}) {
  const closing = balanceLabel(closingBalance);
  return (
    <>
      <View className="flex-row items-center gap-3 border-b border-border px-5 py-4">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text className="text-2xl text-foreground">‹</Text>
        </Pressable>
        <View className="flex-1">
          <Text className="text-xl font-bold text-foreground">Ledger</Text>
          <Text className="text-sm text-muted-foreground" numberOfLines={1}>
            {customerName}
          </Text>
        </View>
      </View>

      <View className="px-5 pb-3 pt-4">
        <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Closing balance
        </Text>
        {pending ? (
          <View className="mt-2">
            <Skeleton width={120} height={26} radius={7} />
          </View>
        ) : (
          <Text
            className={`mt-1 text-2xl font-extrabold ${closing.dr ? "text-orange-700" : "text-green-700"}`}
          >
            {closing.text}
          </Text>
        )}
      </View>
    </>
  );
}
