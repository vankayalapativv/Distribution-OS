/** View-state + derivation for the catalogue "Pick" screen: the selected brand
 *  (top tabs), search, segment filter, the filtered product list, the open
 *  pack-sheet product, and the session-only remembered pack size per product.
 *  The catalogue is organised by BRAND tabs (Fuchs / Savsol / …) — oils only;
 *  bearings are not offered on this screen. */
import { useCallback, useMemo, useRef, useState } from "react";
import type { Product } from "./types";
import { computeDefaultPack, orderSegments, resolveQuickAdd } from "./catalogue-logic";
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
    return orderSegments(set);
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
      // No-choice products go straight to the cart; the rest open the pack sheet.
      const quick = resolveQuickAdd(p);
      if (quick) cart.addProductLine(p.id, quick.pack, quick.segment, 1);
      else setSheetProduct(p);
    },
    [cart.addProductLine],
  );

  const remembered = sheetProduct ? packMemory.current[sheetProduct.id] : undefined;
  const defaultPack = computeDefaultPack(sheetProduct, remembered);

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
