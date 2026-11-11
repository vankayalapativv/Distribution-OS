export const SEGMENT_OPTIONS = [
  { value: "Car", label: "Car" },
  { value: "2W", label: "2W" },
  { value: "3W", label: "3W" },
  { value: "Commercial", label: "Commercial" },
  { value: "Agri", label: "Agri" },
  { value: "Gear Oil", label: "Gear Oil" },
  { value: "Coolant", label: "Coolant" },
  { value: "Grease", label: "Grease" },
];

export interface LineItemDraft {
  /** Stable client id for React keys (drafts have no server id yet). */
  uid: string;
  segment: string;
  productId: string;
  packSizeLitres: number;
  quantityUnits: number;
}

export function emptyLineItem(): LineItemDraft {
  return { uid: crypto.randomUUID(), segment: "", productId: "", packSizeLitres: 0, quantityUnits: 1 };
}

/** True when the picked product is sold by the piece (no pack size). */
export function isQuantityProduct(
  productId: string,
  products: { id: string; unit?: "litres" | "quantity" }[],
): boolean {
  return products.find((p) => p.id === productId)?.unit === "quantity";
}

/** Pack sizes come from the selected product only; total litres shows once both are set. */
export function oilLineView(
  item: LineItemDraft,
  products: { id: string; packSizes: number[]; unit?: "litres" | "quantity" }[],
): { packOptions: number[]; lineLitres: number | null; isQuantity: boolean } {
  const selected = products.find((p) => p.id === item.productId);
  const isQuantity = selected?.unit === "quantity";
  const lineLitres =
    !isQuantity && item.packSizeLitres > 0 && item.quantityUnits > 0
      ? item.packSizeLitres * item.quantityUnits
      : null;
  return { packOptions: selected?.packSizes ?? [], lineLitres, isQuantity };
}
