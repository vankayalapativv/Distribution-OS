import { Pressable, Text, View } from "react-native";
import type { DirectoryCustomer } from "../../lib/customer-directory";
import { ListRowSkeleton, SkeletonList } from "../skeleton";

/** Search results — appear only while typing; app-style contact cards, with a
 *  skeleton / empty state sharing the slot. */
export function CustomerResults({
  trimmedSearch,
  pending,
  filteredCustomers,
  onSelect,
}: {
  readonly trimmedSearch: string;
  readonly pending: boolean;
  readonly filteredCustomers: DirectoryCustomer[];
  readonly onSelect: (c: DirectoryCustomer) => void;
}) {
  if (trimmedSearch.length === 0) return null;
  if (pending) {
    return (
      <View className="mt-2 gap-2">
        <SkeletonList count={3} row={ListRowSkeleton} />
      </View>
    );
  }
  if (filteredCustomers.length === 0) {
    return (
      <Text className="py-6 text-center text-sm text-muted-foreground">
        No customers match “{trimmedSearch}”.
      </Text>
    );
  }
  return (
    <View className="mt-2 gap-2">
      {filteredCustomers.map((c) => (
        <Pressable
          key={c.id}
          className="rounded-3xl border border-border bg-card p-4 active:bg-muted"
          onPress={() => onSelect(c)}
        >
          <View className="flex-row items-center justify-between">
            <Text className="flex-1 pr-2 text-base font-semibold text-card-foreground">
              {c.name}
            </Text>
            {c.code ? <Text className="text-xs text-muted-foreground">{c.code}</Text> : null}
          </View>
          {c.address ? (
            <Text className="mt-0.5 text-sm text-muted-foreground">{c.address}</Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}
