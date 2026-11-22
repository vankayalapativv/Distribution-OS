"use client";

import { ImportStatusBadge, ImportSummary, ImportTotals, ReviewTable } from "@/components/import-ui";
import type { ProductReviewRow } from "./products-import";

const PRODUCT_COLS = [
  { label: "Product" }, { label: "Brand" }, { label: "Segments" },
  { label: "Pack sizes" }, { label: "Status" },
];

function PackCell({ product }: Readonly<{ product: ProductReviewRow["product"] }>) {
  if (product.unit === "quantity") return <span className="text-muted-foreground">piece (sold each)</span>;
  if (product.packs.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
      {product.packs.map((p) => `${p.packSize}L`).join(", ")}
    </span>
  );
}

/** The post-parse review: a ready/error summary + a per-product table showing
 *  each row's status (client error, server error, or imported/ready). */
export function ProductsImportReview({
  rows, readyCount, errCount, totalPacks,
}: Readonly<{ rows: ProductReviewRow[]; readyCount: number; errCount: number; totalPacks: number }>) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ImportSummary ready={readyCount} errors={errCount} total={rows.length} />
        <ImportTotals items={[{ value: totalPacks.toLocaleString("en-IN"), label: "packs" }]} />
      </div>
      <ReviewTable columns={PRODUCT_COLS}>
        {rows.map((r, i) => {
          const msg = r.error ?? r.serverError;
          return (
            <tr key={`${r.product.productName}-${r.product.brand}-${i}`} className={`border-b border-border/60 last:border-0 ${msg ? "bg-red-50/60 dark:bg-red-950/20" : i % 2 ? "bg-muted/20" : ""}`}>
              <td className="px-3 py-2 text-center align-middle">
                <div className="whitespace-nowrap font-semibold text-foreground">{r.product.productName}</div>
                <div className="whitespace-nowrap text-xs text-muted-foreground">{r.product.unit} · HSN {r.product.hsnCode || "—"}</div>
                {msg && <div className="text-[11.5px] text-destructive">{msg}</div>}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-center align-middle font-medium text-primary">{r.product.brand || "—"}</td>
              <td className="whitespace-nowrap px-3 py-2 text-center align-middle text-xs text-muted-foreground">{r.product.segments.join(", ") || "—"}</td>
              <td className="whitespace-nowrap px-3 py-2 text-center align-middle text-xs"><PackCell product={r.product} /></td>
              <td className="px-3 py-2 text-center align-middle"><ImportStatusBadge ok={!msg}>{msg ? "Error" : r.serverError === null ? "Imported" : "Ready"}</ImportStatusBadge></td>
            </tr>
          );
        })}
      </ReviewTable>
    </>
  );
}
