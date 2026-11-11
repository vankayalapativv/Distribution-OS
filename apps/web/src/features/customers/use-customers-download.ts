"use client";

import { useState } from "react";
import { apiGet, type ActionConfig } from "@/lib/api-client";
import { fetchCompanyProfile } from "@/lib/company";
import { downloadCustomersPdf } from "./customers-list-pdf";
import {
  buildDownloadParams,
  buildFilterCaption,
  collectAllCustomers,
  type CustomerFilters,
} from "./customers-list-logic";
import type { Customer } from "./customers-api";

/** One-click "download every matching customer as a PDF" (paginates the server,
 *  then renders the PDF), with a busy flag for the button. */
export function useCustomersDownload(
  actionConfig: ActionConfig,
  filters: CustomerFilters,
  salesExecutives: { id: string; name: string }[],
) {
  const [downloading, setDownloading] = useState(false);

  async function downloadPdf(sort: { id: string; desc: boolean } | undefined) {
    if (downloading) return;
    setDownloading(true);
    try {
      const base = buildDownloadParams(filters, sort);
      const all = await collectAllCustomers((page) => {
        const sp = new URLSearchParams(base);
        sp.set("page", String(page));
        return apiGet<{ customers: Customer[]; total: number }>(
          actionConfig,
          `/customers/paged?${sp.toString()}`,
        );
      });
      const company = await fetchCompanyProfile(actionConfig);
      await downloadCustomersPdf(all, buildFilterCaption(filters, salesExecutives), company);
    } finally {
      setDownloading(false);
    }
  }

  return { downloading, downloadPdf };
}
