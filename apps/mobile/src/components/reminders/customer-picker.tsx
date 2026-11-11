import { Text, TextInput, View, Pressable } from "react-native";
import type { DirectoryCustomer } from "../../lib/customer-directory";
import { usePlaceholderColor } from "../../lib/theme";
import { CustomerResults } from "./customer-results";

/** Customer — inline search (no separate sheet). Results appear only while
 *  typing; a selected customer shows as a directory-style card. */
export function CustomerPicker({
  customer,
  customerSearch,
  trimmedSearch,
  filteredCustomers,
  pending,
  setCustomer,
  setCustomerSearch,
  clearError,
}: {
  readonly customer: DirectoryCustomer | null;
  readonly customerSearch: string;
  readonly trimmedSearch: string;
  readonly filteredCustomers: DirectoryCustomer[];
  readonly pending: boolean;
  readonly setCustomer: (c: DirectoryCustomer | null) => void;
  readonly setCustomerSearch: (s: string) => void;
  readonly clearError: () => void;
}) {
  const placeholder = usePlaceholderColor();
  return (
    <>
      <Text className="mt-4 text-sm font-medium text-foreground">
        Customer <Text className="text-destructive">*</Text>
      </Text>

      {customer ? (
        /* Selected customer — same card style as the Customers directory. */
        <View className="mt-1 flex-row items-center gap-3 rounded-3xl border border-border bg-card p-4">
          <View className="flex-1">
            <Text className="text-base font-semibold text-card-foreground">{customer.name}</Text>
            {customer.address ? (
              <Text className="mt-0.5 text-sm text-muted-foreground">{customer.address}</Text>
            ) : null}
          </View>
          <Pressable
            hitSlop={8}
            onPress={() => {
              setCustomer(null);
              setCustomerSearch("");
            }}
          >
            <Text className="text-sm font-semibold text-primary">Change</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View className="mt-1 flex-row items-center rounded-full border border-border bg-card px-4">
            <Text className="text-base text-muted-foreground">⌕</Text>
            <TextInput
              className="ml-2 flex-1 py-2.5 text-base text-foreground"
              placeholder="Search name or area…"
              placeholderTextColor={placeholder}
              value={customerSearch}
              onChangeText={(t) => {
                setCustomerSearch(t);
                clearError();
              }}
              autoCorrect={false}
              returnKeyType="search"
            />
            {customerSearch ? (
              <Pressable hitSlop={8} onPress={() => setCustomerSearch("")}>
                <Text className="text-base text-muted-foreground">✕</Text>
              </Pressable>
            ) : null}
          </View>

          <CustomerResults
            trimmedSearch={trimmedSearch}
            pending={pending}
            filteredCustomers={filteredCustomers}
            onSelect={(c) => {
              setCustomer(c);
              clearError();
            }}
          />
        </>
      )}
    </>
  );
}
