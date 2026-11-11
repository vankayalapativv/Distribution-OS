import { downloadTablePdf } from "@/lib/pdf-doc";
import type { CompanyProfile } from "@/lib/company";
import type { LedgerData } from "./customer-ledger-tab";
import { buildLedgerOptions } from "./customer-ledger-pdf-data";

/** Generate and download the ledger statement PDF (one click, no print dialog).
 *  `company` is the letterhead from Settings → Company. */
export async function downloadLedgerPdf(
  customerName: string,
  data: LedgerData,
  company: CompanyProfile,
): Promise<void> {
  await downloadTablePdf({ ...buildLedgerOptions(customerName, data), company });
}
