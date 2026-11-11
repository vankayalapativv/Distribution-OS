import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import type { DuesCustomer } from "../../lib/dues";

function dateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** One customer inside a dues bucket — tappable through to their ledger. */
export function DuesCustomerRow({ customer }: { readonly customer: DuesCustomer }) {
  return (
    <Pressable
      className="flex-row items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
      onPress={() =>
        router.push({
          pathname: "/ledger/[id]",
          params: { id: customer.customerId, customerName: customer.customerName },
        })
      }
    >
      <View className="flex-1">
        <Text className="text-sm font-semibold text-card-foreground">{customer.customerName}</Text>
        <Text className="mt-0.5 text-xs text-muted-foreground">
          Oldest invoice {dateLabel(customer.oldestInvoiceDate)} · {customer.ageDays} days
        </Text>
      </View>
      <Text className="text-sm font-bold text-card-foreground">
        ₹{customer.outstanding.toLocaleString("en-IN")}
      </Text>
    </Pressable>
  );
}
