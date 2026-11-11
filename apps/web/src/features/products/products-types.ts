/** One pack row of a product: its litre size (pricing lives in the Margin simulator). */
export interface ProductPack {
  packSize: number;
  /** Inventory: this pack's stock row id (null ⇒ never counted) + balance. */
  stockItemId?: string | null;
  stockQty?: number | null;
}

/** How a product is sold: by litres (with pack sizes) or by plain quantity (pieces). */
export type ProductUnit = "litres" | "quantity";

export interface ManagedProduct {
  hsnCode?: string;
  id: string;
  productName: string;
  brand: string;
  /** Defaults to "litres" for legacy rows without the field. */
  unit: ProductUnit;
  segments: string[];
  packs: ProductPack[];
  status: string;
  createdAt: string;
}
