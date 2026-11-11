import { router } from "expo-router";
import { Keyboard, Pressable, Text, TextInput, View } from "react-native";
import { usePlaceholderColor } from "../../lib/theme";

/** Customers tab header: title, search box (with clear ✕), and "+ Add". */
export function SearchHeader({
  search,
  onChange,
}: {
  readonly search: string;
  readonly onChange: (text: string) => void;
}) {
  const placeholder = usePlaceholderColor();
  const searching = search.trim().length > 0;
  return (
    <View className="border-b border-border px-5 pb-4 pt-4">
      <Text className="text-xl font-bold text-foreground">Customers</Text>
      <View className="mt-3 flex-row items-center gap-2.5">
        <View className="flex-1 flex-row items-center rounded-full border border-border bg-card px-4">
          <Text className="text-base text-muted-foreground">⌕</Text>
          <TextInput
            className="ml-2 flex-1 py-2.5 text-base text-foreground"
            placeholder="Search name, phone or city…"
            placeholderTextColor={placeholder}
            value={search}
            onChangeText={onChange}
            autoCorrect={false}
            returnKeyType="search"
          />
          {searching ? (
            <Pressable
              onPress={() => {
                onChange("");
                Keyboard.dismiss();
              }}
              hitSlop={8}
            >
              <Text className="text-base text-muted-foreground">✕</Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable
          className="rounded-full bg-primary px-4 py-2.5"
          onPress={() => router.push("/customer/new")}
        >
          <Text className="text-sm font-semibold text-primary-foreground">+ Add</Text>
        </Pressable>
      </View>
    </View>
  );
}
