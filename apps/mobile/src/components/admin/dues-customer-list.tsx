import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Skeleton, SkeletonTheme } from "../skeleton";
import type { AdminDuesCustomer } from "../../lib/admin-dues";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** Customers in the selected ageing bucket: name + outstanding, exec · age
 *  subline; taps open the customer. Shimmers while loading. */
export function DuesCustomerList({
  listLoading,
  customers,
}: {
  readonly listLoading: boolean;
  readonly customers: AdminDuesCustomer[];
}) {
  if (listLoading) {
    return (
      <SkeletonTheme>
        <View className="gap-3">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <View key={i} className="rounded-2xl border border-border bg-card p-4">
              {/* Mirrors a real row: name (left) + outstanding (right), then
                  the executive · age subline. */}
              <View className="flex-row items-center justify-between">
                <Skeleton width={160} height={15} />
                <Skeleton width={64} height={15} />
              </View>
              <Skeleton width={120} height={11} style={{ marginTop: 9 }} />
            </View>
          ))}
        </View>
      </SkeletonTheme>
    );
  }

  if (customers.length === 0) {
    return (
      <Text className="py-10 text-center text-sm text-muted-foreground">
        No customers in this bucket.
      </Text>
    );
  }

  return (
    <>
      {customers.map((cust) => (
        <Pressable
          key={cust.customerId}
          onPress={() =>
            router.push({
              pathname: "/customer/[id]",
              params: { id: cust.customerId, name: cust.customerName },
            })
          }
          className="rounded-2xl border border-border bg-card p-4"
        >
          <View className="flex-row items-center justify-between">
            <Text className="flex-1 pr-2 text-[15px] font-semibold text-card-foreground">
              {cust.customerName}
            </Text>
            <Text className="text-[15px] font-bold text-red-600">{inr(cust.outstanding)}</Text>
          </View>
          <Text className="mt-0.5 text-xs text-muted-foreground">
            {cust.executiveName || "—"} · {cust.ageDays} days
          </Text>
        </Pressable>
      ))}
    </>
  );
}
