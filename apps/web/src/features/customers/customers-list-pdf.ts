import { downloadTablePdf } from "@/lib/pdf-doc";
import type { CompanyProfile } from "@/lib/company";
import type { Customer } from "./customers-api";
import { buildCustomersOptions } from "./customers-list-pdf-data";

/**
 * Generate and download the "Customer List" PDF (one click, no print dialog).
 * `filterCaption` describes the active filters (empty = all); `company` is the
 * letterhead from Settings → Company.
 */
export async function downloadCustomersPdf(
  rows: Customer[],
  filterCaption: string,
  company: CompanyProfile,
): Promise<void> {
  await downloadTablePdf({ ...buildCustomersOptions(rows, filterCaption), company });
}
