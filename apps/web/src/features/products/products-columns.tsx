// Barrel: the oil column defs + skeleton live in their own file; re-exported
// here so existing imports keep working. (Oils-only catalogue.)
export type { CatalogueHandlers } from "./products-row-actions";
export { oilColumns, oilSkeleton } from "./oil-columns";
