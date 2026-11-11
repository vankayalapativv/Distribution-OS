"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/data-table/data-table";
import { PageHeader } from "@/components/page-header";
import { type ActionConfig } from "@/lib/api-client";
import { BrandFilterSelect } from "./brand-filter-select";
import { type CatalogueCategory } from "./catalogue-config";
import { downloadProductsTemplate } from "./products-import";
import { ProductsImportDialog } from "./products-import-dialog";
import { useCatalogueTable, type CatalogueHandlerProps } from "./use-catalogue-table";

// Re-exported so existing imports keep working; the constants now live in ./catalogue-config.
export { CATALOGUE_CATEGORIES, type CatalogueCategory } from "./catalogue-config";

/**
 * The unified Products catalogue table. Oils (litres) and quantity products live
 * in one list — the litres/quantity distinction is the product's `unit`, set in
 * the add/edit dialog, not a separate tab.
 */
export function CatalogueTable({
  category, actionConfig, canManage, onAdd, ...handlers
}: CatalogueHandlerProps & {
  readonly category: CatalogueCategory;
  readonly actionConfig: ActionConfig;
  /** false for ACCOUNTANT: catalogue add/edit/delete hidden. */
  readonly canManage: boolean;
  readonly onAdd: () => void;
}) {
  const t = useCatalogueTable(category, actionConfig, canManage, handlers);
  const [importOpen, setImportOpen] = useState(false);
  const [tplBusy, setTplBusy] = useState(false);

  const downloadTemplate = async () => {
    setTplBusy(true);
    try {
      await downloadProductsTemplate(t.brandOptions);
    } finally {
      setTplBusy(false);
    }
  };

  const countLabel = `${t.total} product${t.total !== 1 ? "s" : ""}`;

  return (
    <>
      <PageHeader
        title="Products"
        subtitle={t.isLoading ? "Loading…" : countLabel}
        action={
          canManage ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="size-4" />Bulk Import</Button>
              <Button onClick={onAdd}>+ Add product</Button>
            </div>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2.5">
        <Input
          className="h-9 w-72 bg-white"
          placeholder="Search by name, brand, or code…"
          value={t.search}
          onChange={(e) => t.setSearch(e.target.value)}
        />
        {t.brandFilterable && (
          <BrandFilterSelect brand={t.brand} onChange={t.setBrand} options={t.brandOptions} />
        )}
      </div>

      {t.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{t.error.message}</div>
      )}

      <DataTable
        table={t.table}
        columnCount={t.columns.length}
        isLoading={t.showSkeleton}
        skeleton={t.skeleton}
        pageSize={t.pageSize}
        pageCount={t.pageCount}
        empty={
          t.appliedSearch ? (
            `No products match your search.`
          ) : (
            <>
              {`No products yet.`}
              <span className="mt-4 block">
                <Button variant="outline" onClick={onAdd}>Add your first product</Button>
              </span>
            </>
          )
        }
      />

      {canManage && importOpen && (
        <ProductsImportDialog
          actionConfig={actionConfig}
          open
          onClose={() => setImportOpen(false)}
          onDownloadTemplate={() => void downloadTemplate()}
          downloading={tplBusy}
        />
      )}
    </>
  );
}
