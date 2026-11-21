import { FlatList, Keyboard, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ErrorState } from "../error-state";
import { usePlaceholderColor } from "../../lib/theme";
import { useAvailableStock } from "../../lib/use-available-stock";
import { StockRow } from "./stock-row";
import { StockSkeleton } from "./stock-skeleton";

type Stock = ReturnType<typeof useAvailableStock>;

/** The list area: skeleton / error / empty / the accordion list (early returns). */
function StockBody(s: Readonly<Stock>) {
  if (s.query.isPending) return <StockSkeleton />;
  if (s.query.isError && (s.query.data?.products.length ?? 0) === 0) {
    return <ErrorState error={s.query.error} onRetry={() => s.query.refetch()} />;
  }
  if (s.products.length === 0) {
    return (
      <Text className="px-6 py-16 text-center text-sm text-muted-foreground">
        {s.searching ? `No products match “${s.search.trim()}”.` : "No stock on hand yet."}
      </Text>
    );
  }
  return (
    <FlatList
      data={s.products}
      keyExtractor={(p) => p.productId}
      renderItem={({ item }) => <StockRow product={item} godowns={s.godowns} />}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      contentContainerClassName="pb-8"
    />
  );
}

/**
 * Stock tab (Design A — accordion). Available on-hand stock, product → pack →
 * godown. View-only; online-only (fresh fetch each time the tab opens) with
 * instant client-side search over product name and brand. Used by both the SE
 * `(tabs)` group and the in-app admin `(admin)` group.
 */
export function StockScreen() {
  const s = useAvailableStock();
  const placeholder = usePlaceholderColor();
  const searching = s.search.trim().length > 0;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="border-b border-border px-5 pb-4 pt-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-xl font-bold text-foreground">Stock</Text>
          <View className="flex-row items-center gap-1.5">
            <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#10b981" }} />
            <Text className="text-[11px] text-muted-foreground">Available stock · Live</Text>
          </View>
        </View>
        <View className="mt-3 flex-row items-center rounded-full border border-border bg-muted px-4">
          <Text className="text-base text-muted-foreground">⌕</Text>
          <TextInput
            className="ml-2 flex-1 py-2.5 text-base text-foreground"
            placeholder="Search product or brand…"
            placeholderTextColor={placeholder}
            value={s.search}
            onChangeText={s.setSearch}
            autoCorrect={false}
            returnKeyType="search"
          />
          {searching ? (
            <Pressable
              onPress={() => {
                s.setSearch("");
                Keyboard.dismiss();
              }}
              hitSlop={8}
            >
              <Text className="text-base text-muted-foreground">✕</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <StockBody {...s} />
    </SafeAreaView>
  );
}
