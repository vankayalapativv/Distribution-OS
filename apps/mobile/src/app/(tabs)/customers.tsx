import { FlatList, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AzIndex } from "../../components/customers/az-index";
import { CustomerRow, LetterHeader } from "../../components/customers/customer-row";
import { CustomersSkeleton } from "../../components/customers/customers-skeleton";
import { ErrorState } from "../../components/error-state";
import { SearchHeader } from "../../components/customers/search-header";
import { HEADER_H, ROW_H } from "../../lib/customers/directory-rows";
import { useCustomerDirectory } from "../../lib/customers/use-customer-directory";

/** Customers: a phone-contacts-style A–Z list of the SE's own customers, with
 *  sticky letter headers, a right-side A–Z fast-scroll index, and live search.
 *  Online-only: the full directory loads in one fetch, filtered client-side. */
type Directory = ReturnType<typeof useCustomerDirectory>;

/** The contact area below the search header: skeleton / error / empty / the A–Z
 *  list. Rendered as early returns (not a nested ternary) for clarity. */
function CustomersContent(d: Readonly<Directory>) {
  // Render the empty message directly instead of an empty FlatList: a
  // sticky-header FlatList that transitions from 0 → N rows crashes Fabric
  // ("addViewAt … index=N count=0" — inserting a sticky header into a still-empty
  // container). Keeping it unmounted while empty means it always mounts fresh with
  // real data. The `key` also remounts the list at the search boundary so filtered
  // results and the A–Z directory never reconcile incrementally into each other.
  if (d.customersQuery.isPending) return <CustomersSkeleton />;
  if (d.customersQuery.isError && d.customers.length === 0) {
    // A failed load previously fell through to "No customers yet" — misleading,
    // and a dead-end. Show a real, retryable error instead.
    return <ErrorState error={d.customersQuery.error} onRetry={() => d.customersQuery.refetch()} />;
  }
  if (d.rows.length === 0) {
    return (
      <Text className="px-5 py-16 text-center text-sm text-muted-foreground">
        {d.searching
          ? `No customers match “${d.search.trim()}”.`
          : "No customers yet. Add one with the + Add button."}
      </Text>
    );
  }
  return (
    <View className="flex-1">
      <FlatList
        key={d.searching ? "search" : "directory"}
        ref={d.listRef}
        data={d.rows}
        keyExtractor={(r) => (r.kind === "header" ? `h:${r.letter}` : `c:${r.customer.id}`)}
        renderItem={({ item }) =>
          item.kind === "header" ? (
            <LetterHeader letter={item.letter} />
          ) : (
            <CustomerRow c={item.customer} />
          )
        }
        getItemLayout={(_, index) => ({
          length: d.rows[index]?.kind === "header" ? HEADER_H : ROW_H,
          offset: d.offsets[index] ?? 0,
          index,
        })}
        stickyHeaderIndices={d.stickyHeaderIndices}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-8"
        refreshControl={<RefreshControl refreshing={d.refreshing} onRefresh={d.onRefresh} />}
      />
      {d.showIndex ? <AzIndex presentLetters={d.presentLetters} onJump={d.jumpTo} /> : null}
    </View>
  );
}

export default function CustomersScreen() {
  const dir = useCustomerDirectory();
  return (
    <SafeAreaView className="flex-1 bg-secondary" edges={["top"]}>
      {/* Real search header stays rendered; only the contact rows shimmer. */}
      <SearchHeader search={dir.search} onChange={dir.setSearch} />
      <CustomersContent {...dir} />
    </SafeAreaView>
  );
}
