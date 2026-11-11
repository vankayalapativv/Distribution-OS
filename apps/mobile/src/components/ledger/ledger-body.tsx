/**
 * Scrollable ledger statement: opening balance, transaction rows (or an empty
 * state), and the Debit/Credit/Closing totals footer. Pull-to-refresh refetches
 * the full statement (online-only). Virtualized (FlatList) so a long all-time
 * statement doesn't mount every row at once.
 */
import { FlatList, RefreshControl, Text, View } from "react-native";
import type { LedgerData, LedgerRow as LedgerRowType } from "../../lib/ledger";
import { balanceLabel, fmtDate, rupees } from "../../lib/ledger-format";
import { LedgerRow } from "./ledger-row";

export function LedgerBody({
  data,
  refreshing,
  onRefresh,
}: {
  readonly data: LedgerData;
  readonly refreshing: boolean;
  readonly onRefresh: () => void;
}) {
  const closing = balanceLabel(data.totals.closingBalance);

  const header = (
    <View className="flex-row items-center justify-between rounded-xl border border-dashed border-border bg-card px-4 py-3">
      <Text className="text-[13px] font-semibold text-muted-foreground">
        Opening · before {fmtDate(data.from)}
      </Text>
      <Text className="text-[13px] font-bold text-foreground">
        {balanceLabel(data.openingBalance).text}
      </Text>
    </View>
  );

  const footer = (
    <View className="mt-3 flex-row justify-between gap-2 rounded-2xl bg-foreground px-4 py-3">
      <View>
        <Text className="text-[10px] font-semibold uppercase tracking-wide text-background">Debit</Text>
        <Text className="text-[14px] font-extrabold text-background">{rupees(data.totals.debit)}</Text>
      </View>
      <View>
        <Text className="text-[10px] font-semibold uppercase tracking-wide text-background">Credit</Text>
        <Text className="text-[14px] font-extrabold text-background">{rupees(data.totals.credit)}</Text>
      </View>
      <View className="items-end">
        <Text className="text-[10px] font-semibold uppercase tracking-wide text-background">Closing</Text>
        <Text className="text-[14px] font-extrabold text-background">{closing.text}</Text>
      </View>
    </View>
  );

  return (
    <FlatList<LedgerRowType>
      className="flex-1"
      contentContainerClassName="gap-2 px-5 pb-8 pt-2"
      data={data.rows}
      keyExtractor={(_, i) => String(i)}
      renderItem={({ item }) => <LedgerRow row={item} />}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      ListEmptyComponent={
        <Text className="py-10 text-center text-sm text-muted-foreground">
          No transactions in this period.
        </Text>
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    />
  );
}
