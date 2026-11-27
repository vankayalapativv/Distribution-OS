import { Text, View } from "react-native";
import type { MyPay } from "../../lib/salary";

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** "My pay" — monthly salary and, once paid, this month's net (after advance
 *  recovery). Hidden until a salary is set for the person. */
export function PayCard({ pay }: { readonly pay: MyPay | null }) {
  if (!pay || pay.monthlySalary == null) return null;
  const month = pay.thisMonth;
  return (
    <View className="mb-4 rounded-2xl border border-border bg-card p-4">
      <Text className="text-xs text-muted-foreground">Monthly salary</Text>
      <Text className="text-xl font-bold text-foreground">{rupees(pay.monthlySalary)}</Text>
      {month ? (
        <Text className="mt-1 text-xs text-muted-foreground">
          This month: paid {rupees(month.net)}
          {month.recovered > 0 ? ` (after ${rupees(month.recovered)} advance recovery)` : ""}
        </Text>
      ) : (
        <Text className="mt-1 text-xs text-muted-foreground">Not yet paid this month</Text>
      )}
    </View>
  );
}
