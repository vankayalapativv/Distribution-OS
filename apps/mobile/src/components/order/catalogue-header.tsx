import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { usePlaceholderColor } from "../../lib/theme";
import { SegChip } from "./seg-chip";

/** Search box + brand (company) tabs + segment chips. The top tabs are the
 *  catalogue's brands (Fuchs / Savsol / …); within a brand the segment chips
 *  sub-filter the oils. Oils-only. */
export function CatalogueHeader({
  brands,
  brand,
  onBrand,
  search,
  onSearch,
  segments,
  segmentFilter,
  onSegment,
  creditUnknown,
}: Readonly<{
  brands: string[];
  brand: string | null;
  onBrand: (b: string) => void;
  search: string;
  onSearch: (s: string) => void;
  segments: string[];
  segmentFilter: string | null;
  onSegment: (s: string | null) => void;
  creditUnknown: boolean;
}>) {
  const placeholder = usePlaceholderColor();
  return (
    <View className="bg-secondary">
      {creditUnknown ? (
        <Text className="px-5 pb-1 text-[11px] font-medium text-amber-700">
          Credit status unavailable — proceeding without the block check
        </Text>
      ) : null}
      <View className="px-5 pb-2 pt-1">
        <View className="flex-row items-center rounded-full border border-border bg-card px-4">
          <Text className="text-sm text-muted-foreground">⌕</Text>
          <TextInput
            className="ml-2 flex-1 py-2 text-sm text-foreground"
            placeholder="Search products"
            placeholderTextColor={placeholder}
            value={search}
            onChangeText={onSearch}
            autoCorrect={false}
          />
          {search.length > 0 ? (
            <Pressable onPress={() => onSearch("")} hitSlop={8}>
              <Text className="text-sm text-muted-foreground">✕</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {brands.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="gap-6 px-5"
          className="border-b border-border"
        >
          {brands.map((b) => (
            <Pressable
              key={b}
              className={`pb-2 pt-1 ${brand === b ? "border-b-2 border-primary" : ""}`}
              onPress={() => onBrand(b)}
            >
              <Text
                className={`text-sm font-semibold ${
                  brand === b ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {b}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {segments.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="gap-2 px-5 py-2.5"
        >
          <SegChip label="All" active={segmentFilter === null} onPress={() => onSegment(null)} />
          {segments.map((seg) => (
            <SegChip
              key={seg}
              label={seg}
              active={segmentFilter === seg}
              onPress={() => onSegment(segmentFilter === seg ? null : seg)}
            />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}
