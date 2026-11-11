"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest, type ActionConfig } from "@/lib/api-client";
import { formatDate, rupeesExact } from "@/lib/format";
import type { BillingAccessV2, BillingChargeV2 } from "./billing-v2-api";
import { usePayCheckout } from "./use-pay-checkout";
import { payLabelFor } from "./pay-label";

/** Per-state colour config: status pill, amount colour, and the tinted current-
 *  period block (full border + coloured left accent + soft tint). App palette. */
const STATE: Record<string, { text: string; pill: string; amt: string; block: string }> = {
  active: {
    text: "Active",
    pill: "bg-green-50 text-green-700 ring-green-200",
    amt: "text-green-700",
    block: "border-green-200 border-l-green-500 bg-green-50/50",
  },
  free: {
    text: "Free month",
    pill: "bg-blue-50 text-blue-700 ring-blue-200",
    amt: "text-blue-700",
    block: "border-blue-200 border-l-blue-500 bg-blue-50/50",
  },
  grace: {
    text: "Payment due",
    pill: "bg-amber-50 text-amber-700 ring-amber-200",
    amt: "text-amber-700",
    block: "border-amber-200 border-l-amber-500 bg-amber-50/50",
  },
  blocked: {
    text: "Overdue",
    pill: "bg-red-50 text-red-700 ring-red-200",
    amt: "text-red-700",
    block: "border-red-200 border-l-red-500 bg-red-50/50",
  },
  none: {
    text: "Not set up",
    pill: "bg-slate-100 text-slate-600 ring-slate-200",
    amt: "text-foreground",
    block: "border-border border-l-slate-400 bg-muted/30",
  },
};

const CHARGE: Record<string, { text: string; pill: string }> = {
  paid: { text: "Paid", pill: "bg-green-50 text-green-700 ring-green-200" },
  free: { text: "Free", pill: "bg-blue-50 text-blue-700 ring-blue-200" },
  pending: { text: "Due", pill: "bg-amber-50 text-amber-700 ring-amber-200" },
  void: { text: "Void", pill: "bg-slate-100 text-slate-600 ring-slate-200" },
};

function Pill({ pill, children }: { readonly pill: string; readonly children: ReactNode }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${pill}`}>
      {children}
    </span>
  );
}

const monthLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", month: "long", year: "numeric" }).format(new Date(iso));

const monthShort = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", month: "short", year: "numeric" }).format(new Date(iso));

/** First day of the month after the given period (the next payment date). */
function nextPaymentIso(periodStartIso: string): string {
  const d = new Date(`${periodStartIso.slice(0, 10)}T00:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString();
}

/** Subtitle under the current-period amount — depends on seats vs free cycle. */
function periodSubtitle(current: BillingAccessV2["current"], isFree: boolean): string {
  if (current && current.amountPaisa > 0) {
    return `₹708 × ${current.seats} active user${current.seats === 1 ? "" : "s"} · incl. 18% GST`;
  }
  if (isFree) return "Free month · billing starts next cycle";
  return "Billed at ₹708 per active user, incl. GST";
}

/** The current-period meta row: which dated facts to show for this state. Pure. */
function buildFacts({ current, due, isFree, accessUntil, nextPayment }: Readonly<{
  current: BillingAccessV2["current"]; due: boolean; isFree: boolean;
  accessUntil: string | null; nextPayment: string | null;
}>): Array<{ k: string; v: string }> {
  const facts: Array<{ k: string; v: string }> = [];
  if (!current) return facts;
  if (due) facts.push({ k: "Due", v: formatDate(current.periodStart) });
  else if (isFree) facts.push({ k: "Status", v: "Free — no charge this cycle" });
  else if (current.paidAt) facts.push({ k: "Paid", v: formatDate(current.paidAt) });
  if (accessUntil) facts.push({ k: "Access until", v: accessUntil });
  if (nextPayment) facts.push({ k: isFree ? "First charge" : "Next payment", v: nextPayment });
  return facts;
}

function HistoryRow({ c }: Readonly<{ c: BillingChargeV2 }>) {
  const cc = CHARGE[c.status] ?? { text: c.status, pill: "bg-slate-100 text-slate-600 ring-slate-200" };
  return (
    <tr className="border-t border-border text-center first:border-t-0">
      <td className="px-3 py-2.5 font-medium text-foreground">{monthShort(c.periodStart)}</td>
      <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{c.seats}</td>
      <td className="px-3 py-2.5 tabular-nums">{rupeesExact(c.amountPaisa / 100)}</td>
      <td className="px-3 py-2.5">
        <Pill pill={cc.pill}>{cc.text}</Pill>
      </td>
      <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{c.paidAt ? formatDate(c.paidAt) : "—"}</td>
      <td className="px-3 py-2.5">
        {c.status === "paid" ? (
          <a
            href={`/billing/receipt/${c.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            View
          </a>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}

function HistoryTable({ charges }: Readonly<{ charges: BillingChargeV2[] }>) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="h-3.5 w-1 rounded-full bg-primary" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">History</span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full table-fixed text-[13px]">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="w-1/6 px-3 py-2.5 font-semibold">Month</th>
              <th className="w-1/6 px-3 py-2.5 font-semibold">Users</th>
              <th className="w-1/6 px-3 py-2.5 font-semibold">Amount</th>
              <th className="w-1/6 px-3 py-2.5 font-semibold">Status</th>
              <th className="w-1/6 px-3 py-2.5 font-semibold">Paid on</th>
              <th className="w-1/6 px-3 py-2.5 font-semibold">Receipt</th>
            </tr>
          </thead>
          <tbody>
            {charges.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  No billing history yet.
                </td>
              </tr>
            ) : (
              charges.map((c) => <HistoryRow key={c.id} c={c} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Billing v2 settings panel — standard monthly seat-based payments, "statement"
 * style: an amount-led header (colour-coded by status) with the key dates on a
 * hairline meta row, the month-by-month history, and a quiet onboarding reset.
 * Status colours use the app palette (green = active/paid, amber = due, red =
 * overdue, blue = free). GST invoices are issued manually outside the app.
 */
export function BillingCardV2({
  initialAccess,
  initialCharges,
  actionConfig,
}: {
  readonly initialAccess: BillingAccessV2;
  readonly initialCharges: BillingChargeV2[];
  readonly actionConfig: ActionConfig;
}) {
  const [access, setAccess] = useState<BillingAccessV2>(initialAccess);
  const [charges, setCharges] = useState<BillingChargeV2[]>(initialCharges);

  async function refreshCharges() {
    try {
      const res = await apiRequest<{ items: BillingChargeV2[] }>(actionConfig, "GET", "/billing/charges");
      setCharges(res.items);
    } catch {
      /* keep last known */
    }
  }

  // Refresh the history right after a payment confirms (event-driven, not on mount).
  const { phase, error, payNow } = usePayCheckout(actionConfig, setAccess, () => void refreshCharges());

  const current = access.current;
  const st = STATE[access.state] ?? STATE.none;
  const amount = current ? rupeesExact(current.amountPaisa / 100) : "—";
  const due = current?.status === "pending";
  const isFree = access.state === "free";
  const canPay = access.canPay;
  const payLabel = payLabelFor(phase, amount);
  const accessUntil = access.accessUntilIso ? formatDate(access.accessUntilIso) : null;
  const nextPayment = current ? formatDate(nextPaymentIso(current.periodStart)) : null;

  // Meta row: which facts to show for the current state.
  const facts = buildFacts({ current, due, isFree, accessUntil, nextPayment });

  return (
    <div className="flex flex-col gap-7">
      {/* Current period — statement, tinted + colour-coded by status */}
      <div className={`rounded-lg border border-l-4 p-4 ${st.block}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <span>{current ? monthLabel(current.periodStart) : "This month"}</span>
              <Pill pill={st.pill}>{st.text}</Pill>
            </div>
            <div className={`mt-1.5 text-2xl font-bold tabular-nums ${st.amt}`}>
              {current ? amount : "—"}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {periodSubtitle(current, isFree)}
            </div>
          </div>
          {due && canPay ? (
            <Button onClick={() => void payNow(amount)} disabled={phase !== "idle"} size="sm" className="shrink-0">
              {payLabel}
            </Button>
          ) : null}
        </div>

        {facts.length > 0 ? (
          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-1.5 border-t border-border/60 pt-3 text-[13px]">
            {facts.map((f) => (
              <div key={f.k} className="flex items-baseline gap-1.5">
                <dt className="text-muted-foreground">{f.k}</dt>
                <dd className="font-semibold tabular-nums text-foreground">{f.v}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        {due && !canPay ? (
          <p className="mt-2 text-[13px] text-muted-foreground">Contact your administrator to make the payment.</p>
        ) : null}
      </div>

      <HistoryTable charges={charges} />
    </div>
  );
}
