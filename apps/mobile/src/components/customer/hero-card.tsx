import { Linking, Pressable, Text, View } from "react-native";
import { Icon } from "../icon";
import { Skeleton } from "../skeleton";
import type { Credit, CustomerHeader } from "../../lib/customer/types";

function balanceColor(netBalance: number): string {
  if (netBalance < 0) return "text-green-600";
  if (netBalance > 0) return "text-destructive";
  return "text-muted-foreground";
}

/** Hero: address + phone + net balance, with the credit-block banner. */
export function HeroCard({
  header,
  credit,
  creditPending,
}: {
  readonly header: CustomerHeader | undefined;
  readonly credit: Credit | null;
  readonly creditPending: boolean;
}) {
  const address = [header?.addressStreet, header?.addressCity].filter(Boolean).join(", ");
  const phone = header?.phone ?? null;
  const blocked = credit?.creditBlocked === true;
  // Net balance: negative = paid ahead (green), positive = owed/to collect (red).
  const netBalance = credit?.totalOutstanding ?? 0;

  return (
    <View className="overflow-hidden rounded-3xl border border-border bg-card">
      <View className="p-4">
        {address ? <Text className="text-sm text-muted-foreground">{address}</Text> : null}
        <View className="mt-2 flex-row items-center justify-between">
          {phone ? (
            <Pressable
              className="flex-row items-center gap-1.5 rounded-full bg-accent px-3.5 py-2"
              onPress={() => void Linking.openURL(`tel:${phone}`)}
            >
              <Icon name="call-outline" size={14} color="#334155" />
              <Text className="text-sm font-medium text-accent-foreground">{phone}</Text>
            </Pressable>
          ) : (
            <View />
          )}
          <View className="items-end">
            <Text className="text-xs text-muted-foreground">Balance</Text>
            {creditPending ? (
              <Skeleton width={90} height={22} />
            ) : (
              <Text
                className={`text-xl font-bold ${balanceColor(netBalance)}`}
              >
                ₹{Math.abs(netBalance).toLocaleString("en-IN")}
              </Text>
            )}
          </View>
        </View>
      </View>
      {blocked ? (
        <View className="border-t border-red-200 bg-red-50 px-4 py-3">
          <Text className="text-sm font-semibold text-red-700">
            ⚠ Payments overdue beyond {credit?.creditOverdueDays ?? 60} days
          </Text>
          <Text className="mt-0.5 text-xs text-red-600">
            New orders are blocked until the outstanding is collected.
          </Text>
        </View>
      ) : null}
    </View>
  );
}
