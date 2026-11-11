import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Icon } from "../icon";
import { Skeleton, SkeletonTheme } from "../skeleton";

/** Order / Collect / Market / Ledger / Notes — the customer action row.
 *  Market is field-only (hidden for Super Admin).
 *
 *  Only the primary ORDER button depends on credit — Collect / Market / Ledger /
 *  Notes ALWAYS render, so a slow or failed credit check (common on poor field
 *  networks) never blocks them. Order is a TRI-STATE:
 *    undefined + creditLoading → credit still resolving → skeleton JUST this tile
 *                (so Order never flashes enabled before resolving to Blocked),
 *    undefined + !creditLoading → credit couldn't be determined (errored / offline)
 *                → fail OPEN to "Order"; the order screen runs its own credit
 *                  check and proceeds-with-warning if it still can't load,
 *    true      → "Blocked" (ordering disabled),
 *    false     → "Order".
 */
export function ActionRow({
  id,
  customerName,
  creditBlocked,
  creditLoading,
  isAdmin,
  onMarket,
}: {
  readonly id: string;
  readonly customerName: string;
  readonly creditBlocked: boolean | undefined;
  readonly creditLoading: boolean;
  readonly isAdmin: boolean;
  readonly onMarket: () => void;
}) {
  const blocked = creditBlocked === true;
  const orderResolving = creditBlocked === undefined && creditLoading;
  return (
    <View className="flex-row gap-2">
      {orderResolving ? (
        <SkeletonTheme>
          <View className="flex-1">
            <Skeleton height={58} radius={16} />
          </View>
        </SkeletonTheme>
      ) : (
        <Pressable
          className={`flex-1 items-center gap-0.5 rounded-2xl py-3 ${blocked ? "bg-muted" : "bg-primary"}`}
          disabled={blocked}
          onPress={() => router.push({ pathname: "/order/new", params: { customerId: id, customerName } })}
        >
          <Icon
            name={blocked ? "lock-closed-outline" : "cart-outline"}
            size={20}
            color={blocked ? "#6b7280" : "#ffffff"}
          />
          <Text
            className={`text-[13px] font-semibold ${blocked ? "text-muted-foreground" : "text-primary-foreground"}`}
          >
            {blocked ? "Blocked" : "Order"}
          </Text>
        </Pressable>
      )}
      <Pressable
        className="flex-1 items-center gap-0.5 rounded-2xl bg-accent py-3"
        onPress={() => router.push({ pathname: "/collection/new", params: { customerId: id, customerName } })}
      >
        <Text className="text-lg">₹</Text>
        <Text className="text-[13px] font-semibold text-accent-foreground">Collect</Text>
      </Pressable>
      {!isAdmin && (
        <Pressable
          className="flex-1 items-center gap-0.5 rounded-2xl border border-border bg-card py-3"
          onPress={onMarket}
        >
          <Icon name="camera-outline" size={20} color="#334155" />
          <Text className="text-[13px] font-semibold text-secondary-foreground">Market</Text>
        </Pressable>
      )}
      <Pressable
        className="flex-1 items-center gap-0.5 rounded-2xl border border-border bg-card py-3"
        onPress={() => router.push({ pathname: "/ledger/[id]", params: { id, customerName } })}
      >
        <Icon name="book-outline" size={20} color="#334155" />
        <Text className="text-[13px] font-semibold text-secondary-foreground">Ledger</Text>
      </Pressable>
      <Pressable
        className="flex-1 items-center gap-0.5 rounded-2xl border border-border bg-card py-3"
        onPress={() => router.push({ pathname: "/notes/[id]", params: { id, customerName } })}
      >
        <Icon name="document-text-outline" size={20} color="#334155" />
        <Text className="text-[13px] font-semibold text-secondary-foreground">Notes</Text>
      </Pressable>
    </View>
  );
}
