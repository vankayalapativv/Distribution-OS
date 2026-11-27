import { memo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { packLabel, type StockGodown, type StockPack, type StockProduct } from "../../lib/stock";

function godownName(godowns: StockGodown[], id: string): string {
  return godowns.find((g) => g.id === id)?.name ?? "Godown";
}

/** The two-part label on a pack chip. Litres packs lead with the size ("20 L")
 *  and trail the on-hand count; piece-sold products lead with the count. */
function chipParts(pk: StockPack, unit: StockProduct["unit"]): { lead: string; trail: string } {
  const count = pk.totalUnits.toLocaleString("en-IN");
  if (unit === "quantity") return { lead: count, trail: "pcs" };
  return { lead: packLabel(pk.packSizeLitres, unit), trail: count };
}

/**
 * One product in the Stock list (Design B — pack chips). Collapsed shows the name,
 * brand · segment, and total units, plus a chip per pack size with its on-hand
 * count. Tapping a pack chip reveals that pack's per-godown split as chips (a
 * godown with 0 is dimmed) — built for checking availability before an order
 * without drilling through an accordion. One pack open at a time.
 */
export const StockRow = memo(function StockRow({
  product,
  godowns,
}: {
  readonly product: StockProduct;
  readonly godowns: StockGodown[];
}) {
  const [openPack, setOpenPack] = useState<number | null>(null);
  const meta = [product.segment, product.brand].filter(Boolean).join(" · ");
  const open = product.packs.find((pk) => pk.packSizeLitres === openPack);

  return (
    <View className="border-b border-border px-5 py-3.5">
      <View className="flex-row items-start gap-3">
        <View className="flex-1">
          <Text className="text-[15px] font-semibold text-foreground">{product.productName}</Text>
          {meta ? <Text className="mt-0.5 text-xs text-muted-foreground">{meta}</Text> : null}
        </View>
        <View className="items-end">
          <Text className="text-[15px] font-bold text-foreground">
            {product.totalUnits.toLocaleString("en-IN")}
          </Text>
          <Text className="text-[10px] text-muted-foreground">units</Text>
        </View>
      </View>

      <View className="mt-2.5 flex-row flex-wrap gap-2">
        {product.packs.map((pk) => {
          const sel = pk.packSizeLitres === openPack;
          const { lead, trail } = chipParts(pk, product.unit);
          return (
            <Pressable
              key={pk.packSizeLitres}
              onPress={() => setOpenPack(sel ? null : pk.packSizeLitres)}
              accessibilityRole="button"
              accessibilityLabel={`${lead} ${trail}. Tap to ${sel ? "hide" : "show"} godown split.`}
              className={`flex-row items-baseline rounded-xl border px-2.5 py-1.5 active:opacity-70 ${
                sel ? "border-primary bg-primary/10" : "border-border bg-muted"
              }`}
            >
              <Text className={`text-[13px] font-bold ${sel ? "text-primary" : "text-foreground"}`}>{lead}</Text>
              <Text className="ml-1.5 text-[13px] text-muted-foreground">{trail}</Text>
            </Pressable>
          );
        })}
      </View>

      {open ? (
        <View className="mt-2.5 rounded-xl border border-border bg-muted px-3 py-2.5">
          <Text className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {packLabel(open.packSizeLitres, product.unit)} · by godown
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {open.byGodown.map((g) => (
              <View
                key={g.locationId}
                className="flex-row items-baseline rounded-full border border-border bg-card px-2.5 py-1"
              >
                <Text
                  className={`text-xs ${g.qtyUnits === 0 ? "text-muted-foreground" : "text-foreground"}`}
                >
                  {godownName(godowns, g.locationId)}
                </Text>
                <Text
                  className={`ml-1.5 text-xs font-bold ${g.qtyUnits === 0 ? "text-muted-foreground" : "text-foreground"}`}
                >
                  {g.qtyUnits === 0 ? "—" : g.qtyUnits.toLocaleString("en-IN")}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
});
