import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { addressLine, openInMaps, type DeliverableInvoice } from "../../lib/deliverable-invoice";
import { ErrorState } from "../error-state";
import { Icon } from "../icon";
import { CardRowSkeleton, SkeletonList } from "../skeleton";

export interface InvoicePickerProps {
  isPending: boolean;
  isError: boolean;
  error?: unknown;
  onRetry?: () => void;
  filtered: DeliverableInvoice[];
  search: string;
  placeholder: string;
  onSearch: (t: string) => void;
  onPick: (inv: DeliverableInvoice) => void;
  onBack: () => void;
  /** Pull-to-refresh: true while a re-fetch is in flight. */
  refreshing: boolean;
  /** Pull-to-refresh handler — re-fetches the deliverable invoices from the server. */
  onRefresh: () => void;
}

export function InvoicePicker(p: Readonly<InvoicePickerProps>) {
  return (
    <SafeAreaView className="flex-1 bg-secondary" edges={["top"]}>
      <View className="flex-row items-center gap-3 border-b border-border px-5 py-4">
        <Pressable onPress={p.onBack} hitSlop={8}><Text className="text-2xl text-foreground">‹</Text></Pressable>
        <View>
          <Text className="text-xl font-bold text-foreground">Add delivery</Text>
          <Text className="text-sm text-muted-foreground">Pick the invoice</Text>
        </View>
      </View>
      <View className="px-5 pt-3">
        <View className="flex-row items-center rounded-full border border-border bg-card px-4">
          <Text className="text-base text-muted-foreground">⌕</Text>
          <TextInput
            className="ml-2 flex-1 py-2.5 text-base text-foreground"
            placeholder="Search invoice no or customer…" placeholderTextColor={p.placeholder}
            value={p.search} onChangeText={p.onSearch} autoCorrect={false}
          />
        </View>
      </View>
      {(() => {
        if (p.isPending) {
          return (
            <View className="px-5 py-3"><SkeletonList count={7} row={CardRowSkeleton} /></View>
          );
        }
        if (p.isError) {
          return <ErrorState error={p.error} onRetry={p.onRetry} />;
        }
        return (
          <ScrollView
            className="flex-1"
            contentContainerClassName="grow gap-2.5 px-5 py-3"
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={p.refreshing} onRefresh={p.onRefresh} tintColor={p.placeholder} />}
          >
            {p.filtered.length === 0 ? (
              <Text className="py-10 text-center text-sm text-muted-foreground">
                {p.search.trim() ? "No invoices match your search." : "Pull down to refresh — no invoices to deliver right now."}
              </Text>
            ) : (
              p.filtered.map((inv) => {
                const addr = addressLine(inv);
                return (
                  <Pressable key={inv.id} className="flex-row items-center gap-3 rounded-3xl border border-border bg-card p-3.5" onPress={() => p.onPick(inv)}>
                    <View className="flex-1">
                      <Text className="text-base font-bold text-card-foreground">{inv.invoiceNumber}</Text>
                      <Text className="mt-1 text-sm font-medium text-card-foreground">
                        {inv.customerName ?? "Customer"}
                        {inv.customerCode ? <Text className="text-xs font-normal text-muted-foreground">  ·  {inv.customerCode}</Text> : null}
                      </Text>
                      {addr ? <Text className="mt-0.5 text-xs text-muted-foreground">{addr}</Text> : null}
                    </View>
                    <Pressable onPress={() => openInMaps(inv)} hitSlop={8} accessibilityLabel="Open location in Google Maps" className="h-10 w-10 items-center justify-center rounded-full bg-secondary active:bg-muted">
                      <Icon name="location-outline" size={20} color="#2563eb" />
                    </Pressable>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        );
      })()}
    </SafeAreaView>
  );
}
