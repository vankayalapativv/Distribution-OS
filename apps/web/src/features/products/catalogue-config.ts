import type { ManagedProduct } from "./products-api";

// The catalogue is oils-only (Sri Aparajita sells lubricants).
export type CatalogueCategory = "oils";
export type CatalogueRow = ManagedProduct;

export const CATALOGUE_CATEGORIES: { value: CatalogueCategory; label: string }[] = [
  { value: "oils", label: "Oils" },
];

export const NOUN: Record<CatalogueCategory, string> = { oils: "oil" };

export interface CatalogueMeta {
  queryKey: string;
  path: string;
  rowsKey: string;
  sortId: string;
}

/** The paged-table wiring per category (endpoint, rows key, default sort). */
export const CATALOGUE_META: Record<CatalogueCategory, CatalogueMeta> = {
  oils: { queryKey: "products", path: "/products/paged", rowsKey: "products", sortId: "productName" },
};
