export interface Product {
  id: string;
  productName: string;
  /** Company / brand (e.g. Fuchs, Savsol). */
  brand: string | null;
  /** How it's sold: "litres" (pick a pack size) or "quantity" (pieces, no pack). */
  unit: "litres" | "quantity";
  segments: string[];
  packSizes: number[];
}

