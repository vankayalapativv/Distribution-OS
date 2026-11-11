/** View-state + derivation for the catalogue "Pick" screen: the selected brand
 *  (top tabs), search, segment filter, the filtered product list, the open
 *  pack-sheet product, and the session-only remembered pack size per product.
 *  The catalogue is organised by BRAND tabs (Fuchs / Savsol / …) — oils only;
 *  bearings are not offered on this screen. */
import { useCallback, useMemo, useRef, useState } from "react";
import { SEGMENT_ORDER, type Product } from "./types";
import type { OrderCart } from "./use-order-cart";

export function useCatalogue({
  products,
  cart,
}: {
  products: Product[];
  cart: OrderCart;
}) {
  const [search, setSearch] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<string | null>(null);
  const [brandFilter, setBrandFilter] = useState<string | null>(null);
  const [sheetProduct, setSheetProduct] = useState<Product | null>(null);
  const packMemory = useRef<Record<string, number>>({});

  // Distinct oil brands (e.g. Fuchs / Savsol), stable alphabetical order — these
  // are the top tabs.
  const availableBrands = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.brand) set.add(p.brand);
    });
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [products]);
  // Selected brand tab — defaults to the first so the list shows one brand at a time.
  const brand = brandFilter ?? availableBrands[0] ?? null;

  // Products of the selected brand only — drives both the list and segment chips.
  const brandProducts = useMemo(
    () => (brand ? products.filter((p) => p.brand === brand) : products),
    [products, brand],
  );

  const availableSegments = useMemo(() => {
    const set = new Set<string>();
    brandProducts.forEach((p) => p.segments.forEach((s) => set.add(s)));
    const ordered = SEGMENT_ORDER.filter((s) => set.has(s));
    return [...ordered, ...[...set].filter((s) => !SEGMENT_ORDER.includes(s))];
  }, [brandProducts]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return brandProducts.filter(
      (p) =>
        (!q || p.productName.toLowerCase().includes(q)) &&
        (!segmentFilter || p.segments.includes(segmentFilter)),
    );
  }, [brandProducts, search, segmentFilter]);

  // Switching brand clears a segment filter that may not exist in the new brand.
  const selectBrand = useCallback((b: string) => {
    setBrandFilter(b);
    setSegmentFilter(null);
  }, []);

  /** One pack + ≤1 segment → straight into the cart at qty 1; else open sheet.
   *  Stable identity (cart.addProductLine is a stable useCallback) so it can be
   *  passed straight to the memoized ProductRow. */
  const addOrOpen = useCallback(
    (p: Product) => {
      // Quantity product with a single segment → straight to cart (no pack to pick).
      if (p.unit === "quantity" && p.segments.length <= 1) {
        cart.addProductLine(p.id, null, p.segments[0] ?? null, 1);
        return;
      }
      const packs = p.packSizes ?? [];
      if (p.unit === "litres" && packs.length === 1 && p.segments.length <= 1) {
        cart.addProductLine(p.id, packs[0], p.segments[0] ?? null, 1);
        return;
      }
      setSheetProduct(p);
    },
    [cart.addProductLine],
  );

  const packs = sheetProduct?.packSizes ?? [];
  const remembered = sheetProduct ? packMemory.current[sheetProduct.id] : undefined;
  // Quantity products carry no pack → default null.
  let defaultPack: number | null;
  if (sheetProduct?.unit === "quantity") defaultPack = null;
  else if (remembered && packs.includes(remembered)) defaultPack = remembered;
  else defaultPack = packs[0] ?? 0;

  function addFromSheet(pack: number | null, segment: string | null, qty: number) {
    if (!sheetProduct) return;
    cart.addProductLine(sheetProduct.id, pack, segment, qty);
    if (pack != null) packMemory.current[sheetProduct.id] = pack;
  }

  return {
    search, setSearch, availableSegments, segmentFilter, setSegmentFilter,
    availableBrands, brand, selectBrand,
    filteredProducts, sheetProduct, setSheetProduct, addOrOpen, defaultPack,
    addFromSheet,
  };
}
