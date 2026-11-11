import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { packLabel } from "../../lib/format";
import type { OrderLine, Product } from "../../lib/order/types";
import { QtyField } from "./qty-field";

/** Resting product row. No lines → "Add"; one line → qty stepper + remove;
 *  many lines → "N packs · tap to edit". Tapping the name opens the pack sheet.
 *  memo'd with stable product/id-taking callbacks so editing one row's qty
 *  doesn't re-render the other visible product rows. The single-line qty/remove
 *  act on index 0 (the only line in that case). */
export const ProductRow = memo(function ProductRow({
  product,
  lines,
  onOpen,
  onAdd,
  onQty,
  onRemove,
}: {
  readonly product: Product;
  readonly lines: OrderLine[];
  readonly onOpen: (product: Product) => void;
  readonly onAdd: (product: Product) => void;
  readonly onQty: (id: string, index: number, text: string) => void;
  readonly onRemove: (id: string, index: number) => void;
}) {
  const single = lines.length === 1 ? lines[0] : null;
  let subtitle: string;
  if (single) subtitle = single.packSizeLitres != null ? packLabel(single.packSizeLitres) : "By the piece";
  else subtitle = product.segments.join(" · ");
  return (
    <View className="flex-row items-center gap-3 rounded-3xl border border-border bg-card px-4 py-3.5">
      <Pressable className="flex-1" onPress={() => onOpen(product)}>
        <Text className="text-sm font-medium text-foreground" numberOfLines={2}>
          {product.productName}
        </Text>
        <Text className="text-xs text-muted-foreground">{subtitle}</Text>
      </Pressable>
      {(() => { if (lines.length === 0) return (
        <Pressable className="rounded-full bg-accent px-4 py-2" onPress={() => onAdd(product)}>
          <Text className="text-sm font-semibold text-primary">Add</Text>
        </Pressable>
      ); if (single) return (
        <View className="flex-row items-center gap-2">
          <QtyField
            compact
            value={single.quantityUnits >= 1 ? String(single.quantityUnits) : ""}
            onChange={(t) => onQty(product.id, 0, t)}
          />
          <Pressable onPress={() => onRemove(product.id, 0)} hitSlop={8}>
            <Text className="text-base text-muted-foreground">✕</Text>
          </Pressable>
        </View>
      ); return (
        <Pressable className="items-end" onPress={() => onOpen(product)}>
          <Text className="text-sm font-semibold text-primary">{lines.length} packs</Text>
          <Text className="text-[10px] text-muted-foreground">tap to edit</Text>
        </Pressable>
      ); })()}
    </View>
  );
});
