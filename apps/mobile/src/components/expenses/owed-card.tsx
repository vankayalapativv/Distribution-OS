import { Text, View } from "react-native";

/** "Company owes you ₹X" — the SE's approved-but-unpaid reimbursement total.
 *  Hidden when nothing is owed. */
export function OwedCard({ owedTotal }: { readonly owedTotal: number }) {
  if (owedTotal <= 0) return null;
  return (
    <View className="mb-4 rounded-2xl bg-primary p-4">
      <Text className="text-xs font-medium text-primary-foreground/80">Company owes you</Text>
      <Text className="text-2xl font-bold text-primary-foreground">₹{owedTotal.toLocaleString("en-IN")}</Text>
      <Text className="mt-0.5 text-xs text-primary-foreground/80">Approved claims awaiting payout</Text>
    </View>
  );
}
