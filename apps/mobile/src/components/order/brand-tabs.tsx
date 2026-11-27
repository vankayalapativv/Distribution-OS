import { Pressable, ScrollView, Text } from "react-native";

/** Horizontal brand (company) tab bar for the catalogue. Nothing when there are
 *  no brands. The selected brand gets a primary underline. */
export function BrandTabs({
  brands,
  brand,
  onBrand,
}: {
  readonly brands: string[];
  readonly brand: string | null;
  readonly onBrand: (b: string) => void;
}) {
  if (brands.length === 0) return null;
  return (
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
          <Text className={`text-sm font-semibold ${brand === b ? "text-primary" : "text-muted-foreground"}`}>
            {b}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
