/**
 * One ledger transaction row: date + voucher number + narration and FIFO age
 * chip on the left, Dr/Cr amount + running balance on the right.
 */
import { Text, View } from "react-native";
import type { LedgerRow as Row } from "../../lib/ledger";
import { ageLabel, balanceLabel, fmtDate, rupees } from "../../lib/ledger-format";

function ageToneColor(tone: string): string {
  if (tone === "unpaid") return "text-red-600";
  if (tone === "partial") return "text-orange-700";
  return "text-green-700";
}

export function LedgerRow({ row }: { readonly row: Row }) {
  const sale = row.type === "Sale";
  const bal = balanceLabel(row.balance);
  const age = ageLabel(row);
  return (
    <View className="flex-row justify-between gap-3 rounded-2xl border border-border bg-card px-3.5 py-3">
      <View className="flex-1">
        <Text className="text-[11px] font-semibold text-muted-foreground">{fmtDate(row.date)}</Text>
        <View className="mt-0.5 flex-row flex-wrap items-center gap-x-2">
          <Text className="font-mono text-[13px] font-bold text-foreground">
            {row.vchNo ?? (sale ? "Invoice" : "Receipt")}
          </Text>
          <Text className={`text-[10px] font-bold ${sale ? "text-orange-700" : "text-green-700"}`}>
            {sale ? "SALE" : "RCPT"}
          </Text>
        </View>
        {row.narration ? (
          <Text className="mt-0.5 text-[12px] text-muted-foreground" numberOfLines={1}>
            {row.narration}
          </Text>
        ) : null}
        {age ? (
          <Text
            className={`mt-1 text-[11px] font-semibold ${ageToneColor(age.tone)}`}
          >
            ● {age.text}
          </Text>
        ) : null}
        {row.needsVerify ? (
          <Text className="mt-1 text-[11px] font-bold text-amber-700">⏳ Pending verification</Text>
        ) : null}
      </View>
      <View className="min-w-[92px] items-end">
        <Text className={`text-[15px] font-extrabold ${sale ? "text-orange-700" : "text-green-700"}`}>
          {rupees((row.debit ?? row.credit) ?? 0)}
        </Text>
        <Text className={`mt-1 text-[11px] font-semibold ${bal.dr ? "text-muted-foreground" : "text-green-700"}`}>
          Bal {bal.text}
        </Text>
      </View>
    </View>
  );
}
