/**
 * Invoice PDF: download-and-share (WhatsApp via the system share sheet). Split
 * out of invoice-notifications.ts, which re-exports these for existing callers.
 */
import { fetch as expoFetch } from "expo/fetch";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { API_BASE_URL } from "./api";
import { useAuth } from "./auth";

/**
 * Download the invoice PDF (Bearer-auth) into the app's documents and return
 * the local file URI, or null on failure. The SE views this file in-app
 * (react-native-pdf) before choosing to forward it — nothing is put in a URL.
 * Fetched fresh each time (no offline cache).
 */
export async function downloadInvoicePdf(
  invoiceId: string,
  fileLabel: string,
): Promise<string | null> {
  const token = useAuth.getState().token;
  if (!token) return null;
  // Fail fast on a stalled download (no default fetch timeout) — the caller shows
  // a "couldn't download" message on null instead of hanging the share flow.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await expoFetch(`${API_BASE_URL}/invoice-files/${invoiceId}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());

    const dir = new Directory(Paths.document, "invoices");
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const safeName = fileLabel.replace(/[^\w-]+/g, "_") || "invoice";
    const dest = new File(dir, `${safeName}.pdf`);
    if (dest.exists) dest.delete();
    dest.write(bytes);
    return dest.uri;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Open the system share sheet (WhatsApp, etc.) for an already-downloaded
 * invoice file. Returns false if sharing is unavailable.
 */
export async function shareInvoiceFile(
  fileUri: string,
  fileLabel: string,
): Promise<boolean> {
  try {
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(fileUri, {
      mimeType: "application/pdf",
      dialogTitle: fileLabel,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Download the invoice PDF and open the share sheet directly (legacy one-tap
 * share). Kept for callers that skip the preview.
 */
export async function shareInvoicePdf(
  invoiceId: string,
  fileLabel: string,
): Promise<boolean> {
  const uri = await downloadInvoicePdf(invoiceId, fileLabel);
  if (!uri) return false;
  return shareInvoiceFile(uri, fileLabel);
}
