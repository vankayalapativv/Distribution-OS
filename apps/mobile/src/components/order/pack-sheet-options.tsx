import { Pressable, Text, View } from "react-native";
import { packLabel } from "../../lib/format";
import type { OrderLine, Product } from "../../lib/order/types";

/** Chip used for both pack size and segment picks. */
function Chip({ label, on, onPress }: { readonly label: string; readonly on: boolean; readonly onPress: () => void }) {
  return (
    <Pressable
      className={`rounded-lg border px-3 py-2 ${on ? "border-primary bg-accent" : "border-border"}`}
      onPress={onPress}
    >
      <Text className={`text-xs font-semibold ${on ? "text-primary" : "text-foreground"}`}>
        {label}
      </Text>
    </Pressable>
  );
}

/** The upper half of the pack sheet: product heading, existing cart lines, and
 *  the pack-size + segment choosers. */
export function PackSheetOptions({
  product,
  lines,
  pack,
  onPack,
  segment,
  onSegment,
  onRemoveLine,
}: {
  readonly product: Product;
  readonly lines: OrderLine[];
  readonly pack: number | null;
  readonly onPack: (n: number) => void;
  readonly segment: string | null;
  readonly onSegment: (s: string) => void;
  readonly onRemoveLine: (index: number) => void;
}) {
  const packs = product.packSizes ?? [];
  const isQuantity = product.unit === "quantity";
  return (
    <>
      <View>
        <Text className="text-base font-semibold text-foreground">{product.productName}</Text>
        <Text className="text-xs text-muted-foreground">{product.segments.join(" · ")}</Text>
      </View>
      {lines.length > 0 ? (
        <View className="gap-2 rounded-xl border border-border px-4 py-2.5">
          {lines.map((l, i) => (
            <View key={`${l.packSizeLitres ?? "q"}-${l.quantityUnits}`} className="flex-row items-center">
              <Text className="text-sm text-foreground">
                {l.packSizeLitres != null
                  ? `${l.quantityUnits} × ${packLabel(l.packSizeLitres)}`
                  : `${l.quantityUnits} pcs`}
              </Text>
              <Pressable className="ml-auto" hitSlop={8} onPress={() => onRemoveLine(i)}>
                <Text className="text-sm text-muted-foreground">✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {isQuantity ? null : (
        <View>
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Pack size
          </Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {packs.map((size) => (
              <Chip key={size} label={packLabel(size)} on={pack === size} onPress={() => onPack(size)} />
            ))}
          </View>
          {packs.length === 0 ? (
            <Text className="mt-2 text-xs text-muted-foreground">
              No pack sizes set for this product.
            </Text>
          ) : null}
        </View>
      )}
      {product.segments.length > 1 ? (
        <View>
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Segment
          </Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {product.segments.map((seg) => (
              <Chip key={seg} label={seg} on={segment === seg} onPress={() => onSegment(seg)} />
            ))}
          </View>
        </View>
      ) : null}
    </>
  );
}
