/**
 * SE invoice notifications: the /me/notifications feed. Push-token registration
 * lives in ./push-token and invoice PDF download-and-share in ./invoice-pdf;
 * both are re-exported here so existing `./invoice-notifications` imports keep
 * working.
 */
import { apiFetch } from "./api";
import { useAuth } from "./auth";

export { downloadInvoicePdf, shareInvoiceFile, shareInvoicePdf } from "./invoice-pdf";
export { registerPushToken } from "./push-token";

export interface InvoiceNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  invoiceId: string | null;
  /** Dues-bucket alerts carry the customer so the row can open their ledger. */
  customerId: string | null;
  createdAt: string;
  readAt: string | null;
}

export async function fetchNotifications(): Promise<InvoiceNotification[]> {
  const token = useAuth.getState().token;
  if (!token) return [];
  const data = await apiFetch<{ notifications: InvoiceNotification[] }>(
    "/me/notifications",
    { token },
  );
  return data.notifications;
}

export async function markNotificationRead(id: string): Promise<void> {
  const token = useAuth.getState().token;
  if (!token) return;
  await apiFetch(`/me/notifications/${id}/read`, { method: "POST", token, body: {} }).catch(
    () => undefined,
  );
}

/** Delete a single notification from the SE's feed. */
export async function deleteNotification(id: string): Promise<void> {
  const token = useAuth.getState().token;
  if (!token) return;
  await apiFetch(`/me/notifications/${id}`, { method: "DELETE", token }).catch(() => undefined);
}

/** Clear the SE's entire notification feed. */
export async function clearAllNotifications(): Promise<void> {
  const token = useAuth.getState().token;
  if (!token) return;
  await apiFetch("/me/notifications", { method: "DELETE", token }).catch(() => undefined);
}
