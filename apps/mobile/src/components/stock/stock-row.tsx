import { memo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Icon } from "../icon";
import { packLabel, type StockGodown, type StockPack, type StockProduct } from "../../lib/stock";

function godownName(godowns: StockGodown[], id: string): string {
  return godowns.find((g) => g.id === id)?.name ?? "Godown";
}

/** "150 u · 750 L" for litres packs; "150 pcs" for piece-sold products. */
function packTotal(pk: StockPack, unit: StockProduct["unit"]): string {
  if (unit === "quantity") return `${pk.totalUnits} pcs`;
  const litres = pk.totalUnits * pk.packSizeLitres;
  return `${pk.totalUnits} u · ${litres.toLocaleString("en-IN")} L`;
}

/**
 * One product in the Stock list (Design A — accordion). Collapsed: name, brand ·
 * segment, and total units on the right. Tapped: expands to each pack size with
 * its per-godown quantities (a godown with 0 is dimmed).
 */
export const StockRow = memo(function StockRow({
  product,
  godowns,
}: {
  readonly product: StockProduct;
  readonly godowns: StockGodown[];
}) {
  const [open, setOpen] = useState(false);
  const meta = [product.segment, product.brand].filter(Boolean).join(" · ");

  return (
    <View className="border-b border-border">
      <Pressable
        className="flex-row items-center gap-3 px-5 py-3.5 active:bg-accent"
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`${product.productName}, ${product.totalUnits} units. Tap to ${open ? "collapse" : "expand"}.`}
      >
        <View className="flex-1">
          <Text className="text-[15px] font-semibold text-foreground">{product.productName}</Text>
          {meta ? <Text className="mt-0.5 text-xs text-muted-foreground">{meta}</Text> : null}
        </View>
        <View className="items-end">
          <Text className="text-[15px] font-bold text-foreground">{product.totalUnits}</Text>
          <Text className="text-[10px] text-muted-foreground">units</Text>
        </View>
        <Icon name={open ? "chevron-down" : "chevron-forward"} size={18} color="#9ca3af" />
      </Pressable>

      {open ? (
        <View className="bg-muted px-5 pb-3 pt-1">
          {product.packs.map((pk) => (
            <View key={pk.packSizeLitres} className="pt-2">
              <View className="flex-row items-center">
                <Text className="text-[13px] font-semibold text-foreground">
                  {packLabel(pk.packSizeLitres, product.unit)}
                </Text>
                <Text className="ml-auto text-xs text-muted-foreground">{packTotal(pk, product.unit)}</Text>
              </View>
              {pk.byGodown.map((g) => (
                <View key={g.locationId} className="mt-1 flex-row items-center">
                  <View className="mr-2 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#cbd5e1" }} />
                  <Text className="text-xs text-muted-foreground">{godownName(godowns, g.locationId)}</Text>
                  <Text className={`ml-auto text-xs ${g.qtyUnits === 0 ? "text-muted-foreground" : "font-medium text-foreground"}`}>
                    {g.qtyUnits}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
});
