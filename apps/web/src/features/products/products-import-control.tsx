"use client";

import { useState } from "react";
import { type ActionConfig } from "@/lib/api-client";
import { downloadProductsTemplate } from "./products-import";
import { ProductsHeaderMenu } from "./products-header-menu";
import { ProductsImportDialog } from "./products-import-dialog";

/** The ⋮ Bulk-Import control: the kebab trigger + the import dialog it opens, with
 *  the template download wired to the catalogue's current brands. */
export function ProductsImportControl({
  actionConfig,
  brandOptions,
}: Readonly<{ actionConfig: ActionConfig; brandOptions: string[] }>) {
  const [open, setOpen] = useState(false);
  const [tplBusy, setTplBusy] = useState(false);

  const downloadTemplate = async () => {
    setTplBusy(true);
    try {
      await downloadProductsTemplate(brandOptions);
    } finally {
      setTplBusy(false);
    }
  };

  return (
    <>
      <ProductsHeaderMenu onImport={() => setOpen(true)} />
      {open && (
        <ProductsImportDialog
          actionConfig={actionConfig}
          open
          onClose={() => setOpen(false)}
          onDownloadTemplate={() => void downloadTemplate()}
          downloading={tplBusy}
        />
      )}
    </>
  );
}
