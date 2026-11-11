import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { parseQty, type OrderLine, type Product } from "../../lib/order/types";
import { PackSheetOptions } from "./pack-sheet-options";
import { QtyField } from "./qty-field";

/** Pack / segment / quantity bottom sheet. Seeds from a session-remembered pack
 *  (defaultPack) and the product's first segment; Add merges into the cart. */
export function PackSheet({
  product,
  lines,
  defaultPack,
  onClose,
  onAdd,
  onRemoveLine,
}: {
  readonly product: Product | null;
  readonly lines: OrderLine[];
  readonly defaultPack: number | null;
  readonly onClose: () => void;
  readonly onAdd: (pack: number | null, segment: string | null, qty: number) => void;
  readonly onRemoveLine: (index: number) => void;
}) {
  const [pack, setPack] = useState<number | null>(defaultPack);
  const [segment, setSegment] = useState<string | null>(product?.segments[0] ?? null);
  const [qty, setQty] = useState("1");
  // Bare <Modal> → outside the SafeAreaProvider tree; pad by the device inset.
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (product) {
      setPack(defaultPack);
      setSegment(product.segments[0] ?? null);
      setQty("1");
    }
  }, [product, defaultPack]);

  const isQuantity = product?.unit === "quantity";
  const qtyN = parseQty(qty);
  // Litres products need a pack; quantity products just need a valid count.
  const valid = qtyN !== null && (isQuantity || (pack != null && pack > 0));
  function add() {
    if (valid && qtyN !== null) {
      onAdd(isQuantity ? null : pack, segment, qtyN);
      onClose();
    }
  }

  return (
    <Modal visible={product !== null} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <Pressable className="flex-1 bg-black/50" onPress={onClose} />
        <View
          className="gap-4 rounded-t-3xl bg-card px-5 pt-2"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <View className="h-1 w-10 self-center rounded-full bg-border" />
          {product ? (
            <PackSheetOptions
              product={product}
              lines={lines}
              pack={pack}
              onPack={setPack}
              segment={segment}
              onSegment={setSegment}
              onRemoveLine={onRemoveLine}
            />
          ) : null}
          <View>
            <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Quantity
            </Text>
            <View className="mt-2">
              <QtyField value={qty} onChange={setQty} />
            </View>
          </View>
          <Pressable
            className={`items-center rounded-full bg-primary py-3.5 ${valid ? "" : "opacity-40"}`}
            disabled={!valid}
            onPress={add}
          >
            <Text className="text-sm font-semibold text-primary-foreground">Add</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
