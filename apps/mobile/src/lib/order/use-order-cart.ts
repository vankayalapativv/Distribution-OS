/** In-memory order cart (oils only) with derived totals + mutators. Fully
 *  online, no persistence — state lives only for the screen session. */
import { useCallback, useMemo, useState } from "react";
import type { OrderItemPayload } from "./api";
import { parseQty, type OrderLine } from "./types";

export function useOrderCart() {
  const [cart, setCart] = useState<Record<string, OrderLine[]>>({});

  // All mutators use functional setState + useCallback([]) — STABLE identities let React.memo skip untouched rows.

  /** Merge a pack line in (sums qty when the same pack+segment already exists). */
  const addProductLine = useCallback(
    (id: string, pack: number | null, segment: string | null, qty: number) => {
      setCart((c) => {
        const lines = [...(c[id] ?? [])];
        const at = lines.findIndex((l) => l.packSizeLitres === pack && l.segment === segment);
        if (at >= 0) lines[at] = { ...lines[at], quantityUnits: lines[at].quantityUnits + qty };
        else lines.push({ packSizeLitres: pack, quantityUnits: qty, segment });
        return { ...c, [id]: lines };
      });
    },
    [],
  );
  const removeLine = useCallback((id: string, index: number) => {
    setCart((c) => {
      const lines = (c[id] ?? []).filter((_, i) => i !== index);
      if (lines.length === 0) {
        const { [id]: _gone, ...rest } = c;
        return rest;
      }
      return { ...c, [id]: lines };
    });
  }, []);
  const setLineQty = useCallback((id: string, index: number, text: string) => {
    const n = parseQty(text);
    setCart((c) => ({
      ...c,
      [id]: c[id].map((l, i) => (i === index ? { ...l, quantityUnits: n ?? 0 } : l)),
    }));
  }, []);
  const reset = useCallback(() => {
    setCart({});
  }, []);

  const orderedProductIds = Object.keys(cart).filter((id) => cart[id].length > 0);
  const totalLines = orderedProductIds.reduce((s, id) => s + cart[id].length, 0);
  // Round — raw float sums of fractional packs otherwise surface "2.70000…2 L".
  const totalLitres =
    Math.round(
      orderedProductIds.reduce(
        (s, id) => s + cart[id].reduce((a, l) => a + l.quantityUnits * (l.packSizeLitres ?? 0), 0),
        0,
      ) * 100,
    ) / 100;
  const cartCount = totalLines;
  const canSubmit =
    cartCount > 0 && orderedProductIds.every((id) => cart[id].every((l) => l.quantityUnits >= 1));

  const items: OrderItemPayload[] = useMemo(() => {
    const ids = Object.keys(cart).filter((id) => cart[id].length > 0);
    return ids.flatMap((productId) =>
      cart[productId].map((l) => ({
        productId,
        quantityUnits: l.quantityUnits,
        packSizeLitres: l.packSizeLitres,
        segment: l.segment,
      })),
    );
  }, [cart]);

  return {
    cart, addProductLine, removeLine, setLineQty,
    reset, orderedProductIds, totalLines, totalLitres, cartCount, canSubmit, items,
  };
}

export type OrderCart = ReturnType<typeof useOrderCart>;
