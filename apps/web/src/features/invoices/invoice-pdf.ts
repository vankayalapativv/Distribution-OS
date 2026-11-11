/**
 * Thin web wrappers over the shared invoice PDF renderer. The BAL-layout renderer
 * lives in @distribution-os/shared — the single source of truth, rendered on demand
 * from data (never stored). These fetch the self-contained payload
 * (`GET /invoices/:id/pdf-data`) and render to download or open in a new tab.
 */
import { buildInvoiceDoc, type PdfData } from "@distribution-os/shared";
import { apiRequest, type ActionConfig } from "@/lib/api-client";

export { DEFAULT_TERMS } from "@distribution-os/shared";
export type { PdfData } from "@distribution-os/shared";

async function renderDoc(cfg: ActionConfig, invoiceId: string) {
  const data = await apiRequest<PdfData>(cfg, "GET", `/invoices/${invoiceId}/pdf-data`);
  return { data, doc: await buildInvoiceDoc(data) };
}

/** Build + download the invoice PDF (the ⋮ Download action). */
export async function downloadInvoicePdf(cfg: ActionConfig, invoiceId: string): Promise<void> {
  const { data, doc } = await renderDoc(cfg, invoiceId);
  doc.save(`${data.invoice.invoiceNumber.replace(/[^\w-]+/g, "_")}.pdf`);
}

/**
 * Build the invoice PDF and open it in a new browser tab (row-click). The tab is
 * opened synchronously inside the click gesture (then pointed at the rendered
 * blob) so it isn't caught by the popup blocker.
 */
export async function openInvoicePdfInNewTab(cfg: ActionConfig, invoiceId: string): Promise<void> {
  const win = window.open("", "_blank");
  try {
    const { doc } = await renderDoc(cfg, invoiceId);
    const url = URL.createObjectURL(doc.output("blob"));
    if (win) win.location.href = url;
    else window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    win?.close();
    throw e;
  }
}
