import { Linking, Pressable, Text, View } from "react-native";
import { Icon } from "../icon";
import { Skeleton } from "../skeleton";
import { openLocationInMaps } from "../../lib/open-in-maps";
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
  const hasCoords = header?.latitude != null && header?.longitude != null;
  // Show the maps pin when there's something to open — saved coordinates, or an
  // address to search (same fallback as the delivery screen).
  const canMap = hasCoords || address.length > 0;
  const blocked = credit?.creditBlocked === true;
  // Net balance: negative = paid ahead (green), positive = owed/to collect (red).
  const netBalance = credit?.totalOutstanding ?? 0;

  return (
    <View className="overflow-hidden rounded-3xl border border-border bg-card">
      <View className="gap-3 p-4">
        {/* Address, with a tap-to-navigate maps pin trailing it. */}
        <View className="flex-row items-start justify-between gap-3">
          <Text className="flex-1 text-sm leading-5 text-muted-foreground">
            {address || "No address on file"}
          </Text>
          {canMap ? (
            <Pressable
              onPress={() =>
                openLocationInMaps({
                  latitude: header?.latitude ?? null,
                  longitude: header?.longitude ?? null,
                  address,
                })
              }
              hitSlop={8}
              accessibilityLabel="Open location in Google Maps"
              className="h-9 w-9 items-center justify-center rounded-full bg-secondary active:bg-muted"
            >
              <Icon name="location-outline" size={18} color="#2563eb" />
            </Pressable>
          ) : null}
        </View>

        {/* Phone to dial, and the net balance. */}
        <View className="flex-row items-center justify-between gap-3">
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
              <Text className={`text-xl font-bold ${balanceColor(netBalance)}`}>
                ₹{Math.abs(netBalance).toLocaleString("en-IN")}
              </Text>
            )}
          </View>
        </View>
      </View>
      {blocked ? (
        <View className="border-t border-red-200 bg-red-50 px-4 py-3">
          <Text className="text-sm font-semibold text-red-700">
            ⚠ Payments past the {credit?.creditOverdueDays ?? 0}-day credit period
          </Text>
          <Text className="mt-0.5 text-xs text-red-600">
            New orders are blocked until the outstanding is collected.
          </Text>
        </View>
      ) : null}
    </View>
  );
}
