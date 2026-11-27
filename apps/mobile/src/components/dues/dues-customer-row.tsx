import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import type { DuesCustomer } from "../../lib/dues";

function dateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Severity colour by how overdue the oldest invoice is — the same
 * green→amber→orange→red scale the Home dues strip uses (TONE_STOPS), here
 * keyed by age in days rather than band position. Drives the amount, the
 * oldest-invoice date, and the days count on the row so the worst debt reads
 * at a glance.
 */
export function toneForAge(ageDays: number): string {
  if (ageDays <= 30) return "text-green-600";
  if (ageDays <= 45) return "text-amber-600";
  if (ageDays <= 60) return "text-orange-600";
  return "text-red-600";
}

/** One customer inside a dues bucket — tappable through to their ledger. */
export function DuesCustomerRow({ customer }: { readonly customer: DuesCustomer }) {
  const tone = toneForAge(customer.ageDays);
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
          Oldest invoice{" "}
          <Text className={`font-semibold ${tone}`}>{dateLabel(customer.oldestInvoiceDate)}</Text>
          {" · "}
          <Text className={`font-semibold ${tone}`}>{customer.ageDays} days</Text>
        </Text>
      </View>
      <Text className={`text-sm font-bold ${tone}`}>
        ₹{customer.outstanding.toLocaleString("en-IN")}
      </Text>
    </Pressable>
  );
}
