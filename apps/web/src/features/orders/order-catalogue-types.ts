export interface Product {
  id: string;
  productName: string;
  /** How it's sold: "litres" (pick a pack size) or "quantity" (pieces, no pack). */
  unit: "litres" | "quantity";
  segments: string[];
  packSizes: number[];
}

