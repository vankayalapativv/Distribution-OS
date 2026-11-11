import { FlatList, Modal, Pressable, Text, TextInput, View } from "react-native";
import { Icon } from "../icon";
import { usePlaceholderColor } from "../../lib/theme";

/** Bottom-sheet picker body for {@link SalesExecSelect} — a searchable list of
 *  active executives. Presentational: the query/search state lives in the field. */
export function SalesExecPickerModal({
  visible,
  value,
  filtered,
  isPending,
  search,
  onSearch,
  onSelect,
  onClose,
}: {
  readonly visible: boolean;
  readonly value: string | null;
  readonly filtered: { id: string; name: string }[];
  readonly isPending: boolean;
  readonly search: string;
  readonly onSearch: (q: string) => void;
  readonly onSelect: (id: string, name: string) => void;
  readonly onClose: () => void;
}) {
  const placeholderColor = usePlaceholderColor();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-6" onPress={onClose}>
        <Pressable
          className="max-h-[70%] w-full max-w-md rounded-3xl bg-card px-5 pb-5 pt-5"
          onPress={() => undefined}
        >
          <Text className="mb-3 text-lg font-bold text-foreground">Assign sales executive</Text>
          <View className="mb-3 flex-row items-center rounded-full border border-border bg-background px-4">
            <Text className="text-base text-muted-foreground">⌕</Text>
            <TextInput
              className="ml-2 flex-1 py-2.5 text-base text-foreground"
              placeholder="Search executive…"
              placeholderTextColor={placeholderColor}
              value={search}
              onChangeText={onSearch}
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>
          {isPending ? (
            <Text className="py-8 text-center text-sm text-muted-foreground">Loading…</Text>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(e) => e.id}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              ListEmptyComponent={
                <Text className="py-8 text-center text-sm text-muted-foreground">
                  No executives found.
                </Text>
              }
              renderItem={({ item }) => {
                const selected = item.id === value;
                return (
                  <Pressable
                    onPress={() => {
                      onSelect(item.id, item.name);
                      onClose();
                    }}
                    className={`flex-row items-center justify-between rounded-xl px-4 py-3 ${
                      selected ? "bg-primary/10" : ""
                    }`}
                  >
                    <Text
                      className={`text-base ${
                        selected ? "font-semibold text-primary" : "text-foreground"
                      }`}
                    >
                      {item.name}
                    </Text>
                    {selected ? <Icon name="checkmark" size={18} color="#2563eb" /> : null}
                  </Pressable>
                );
              }}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
