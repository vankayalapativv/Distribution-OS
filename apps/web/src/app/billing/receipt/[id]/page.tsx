import { notFound, redirect } from "next/navigation";
import { requireSessionRole, isWebRole, dashboardForRole } from "@/features/auth/auth-role";
import { loadReceipt } from "@/features/billing/billing-v2-api";
import { RECEIPT_VENDOR } from "@/features/billing/receipt-vendor";
import { companyAddressLines } from "@/lib/company";
import { rupeesExact, formatDate } from "@/lib/format";
import { ReceiptPrintButton } from "@/features/billing/receipt-print-button";

export const dynamic = "force-dynamic";

const monthLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", month: "long", year: "numeric" }).format(new Date(iso));

const rs = (paisa: number) => rupeesExact(paisa / 100);

/**
 * Standalone payment-receipt page (opened in a new tab from the billing history).
 * Issued by the vendor (Vardhan Systems — see RECEIPT_VENDOR) to the client
 * (the company profile, shown as "Billed to"). A simple acknowledgment of a paid
 * month — the formal GST tax invoice is issued separately/manually. Rendered
 * outside the dashboard shell so there's no nav or billing overlay, and it prints
 * cleanly.
 */
export default async function ReceiptPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const auth = await requireSessionRole();
  if (!isWebRole(auth.role)) redirect(dashboardForRole(auth.role));

  const { id } = await params;
  const data = await loadReceipt(id);
  if (!data) notFound();

  const { charge, gst, company, config } = data;
  const client = company.legalName;
  const clientAddress = companyAddressLines(company).join("\n");
  // Per-enterprise price description + GST half-rate (default 18% → 9% + 9%).
  const halfPct = ((config?.gstRateBp ?? 1800) / 2 / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const lineDesc =
    config?.model === "flat"
      ? "Flat monthly (incl. GST)"
      : `${charge.seats} active user${charge.seats === 1 ? "" : "s"} × ₹${((config?.unitAmountPaisa ?? 0) / 100).toLocaleString("en-IN")} (incl. GST)`;

  return (
    <main className="mx-auto max-w-2xl px-5 py-10 text-foreground print:py-0">
      <div className="rounded-xl border border-border bg-card p-8 shadow-sm print:border-0 print:shadow-none">
        {/* Header: vendor (issuer) + receipt status */}
        <div className="flex items-start justify-between gap-6 border-b border-border pb-5">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={RECEIPT_VENDOR.logo} alt={RECEIPT_VENDOR.legalName} className="mb-2 h-9 w-auto" />
            <p className="text-sm font-semibold text-foreground">{RECEIPT_VENDOR.legalName}</p>
            <p className="mt-1 max-w-xs whitespace-pre-line text-[12px] leading-relaxed text-muted-foreground">
              {RECEIPT_VENDOR.address}
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              GSTIN: {RECEIPT_VENDOR.gstin} · PAN: {RECEIPT_VENDOR.pan}
            </p>
            <p className="text-[12px] text-muted-foreground">
              {RECEIPT_VENDOR.email} · {RECEIPT_VENDOR.phone}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Payment receipt</p>
            <p className="mt-1 text-sm font-semibold text-green-700">Paid</p>
          </div>
        </div>

        {/* Billed to (client) + payment meta */}
        <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Billed to</p>
            <p className="mt-1.5 text-sm font-semibold text-foreground">{client || "—"}</p>
            {clientAddress ? (
              <p className="mt-0.5 max-w-xs whitespace-pre-line text-[12px] leading-relaxed text-muted-foreground">
                {clientAddress}
              </p>
            ) : null}
            {company.gstin ? <p className="mt-0.5 text-[12px] text-muted-foreground">GSTIN: {company.gstin}</p> : null}
          </div>
          <dl className="text-[13px] sm:text-right">
            <div className="flex justify-between sm:justify-end sm:gap-3">
              <dt className="text-muted-foreground">Date paid</dt>
              <dd className="font-medium tabular-nums">{charge.paidAt ? formatDate(charge.paidAt) : "—"}</dd>
            </div>
            <div className="mt-1 flex justify-between sm:justify-end sm:gap-3">
              <dt className="text-muted-foreground">Billing month</dt>
              <dd className="font-medium">{monthLabel(charge.periodStart)}</dd>
            </div>
            <div className="mt-1 flex justify-between sm:justify-end sm:gap-3">
              <dt className="text-muted-foreground">Payment reference</dt>
              <dd className="font-mono text-xs">{charge.razorpayPaymentId ?? "—"}</dd>
            </div>
            <div className="mt-1 flex justify-between sm:justify-end sm:gap-3">
              <dt className="text-muted-foreground">SAC</dt>
              <dd className="font-medium tabular-nums">{RECEIPT_VENDOR.sac}</dd>
            </div>
          </dl>
        </div>

        {/* Line items */}
        <table className="mt-6 w-full text-[13px]">
          <thead>
            <tr className="border-y border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="py-2 font-semibold">Description</th>
              <th className="py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/70">
              <td className="py-2.5">
                Monthly access — {monthLabel(charge.periodStart)}
                <span className="block text-xs text-muted-foreground">
                  {lineDesc} · SAC {RECEIPT_VENDOR.sac}
                </span>
              </td>
              <td className="py-2.5 text-right tabular-nums">{rs(gst.taxablePaisa)}</td>
            </tr>
          </tbody>
          <tfoot className="tabular-nums">
            <tr>
              <td className="py-1.5 text-right text-muted-foreground">Taxable value</td>
              <td className="py-1.5 text-right">{rs(gst.taxablePaisa)}</td>
            </tr>
            <tr>
              <td className="py-1.5 text-right text-muted-foreground">CGST ({halfPct}%)</td>
              <td className="py-1.5 text-right">{rs(gst.cgstPaisa)}</td>
            </tr>
            <tr>
              <td className="py-1.5 text-right text-muted-foreground">SGST ({halfPct}%)</td>
              <td className="py-1.5 text-right">{rs(gst.sgstPaisa)}</td>
            </tr>
            <tr className="border-t border-border">
              <td className="py-2.5 text-right font-semibold">Total paid</td>
              <td className="py-2.5 text-right text-base font-bold">{rs(charge.amountPaisa)}</td>
            </tr>
          </tfoot>
        </table>

        <p className="mt-6 text-[11.5px] leading-relaxed text-muted-foreground">
          This is a computer-generated payment receipt and does not require a signature. A GST tax invoice, where
          applicable, is issued separately.
        </p>
      </div>

      <div className="mt-4 flex justify-center print:hidden">
        <ReceiptPrintButton />
      </div>
    </main>
  );
}
