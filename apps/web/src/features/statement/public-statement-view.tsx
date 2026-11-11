import { rupeesExact, formatDate, formatDateTime } from "@/lib/format";
import { companyAddressLines } from "@/lib/company";
import type { PublicStatement, StatementLedgerRow } from "./statement-types";

/** "1,234.00 Dr" / "1,234.00 Cr" from a signed balance (>= 0 ⇒ Dr). */
function balanceLabel(n: number): string {
  return `${rupeesExact(Math.abs(n))} ${n >= 0 ? "Dr" : "Cr"}`;
}

/** The transaction description column. */
function particulars(row: StatementLedgerRow): string {
  if (row.narration === "Sales_return") return "Sales Return";
  return row.narration || row.type;
}

/** Paid-off status (Sale rows only). */
function paidOff(row: StatementLedgerRow): { label: string; className: string } {
  if (row.type !== "Sale") return { label: "—", className: "text-muted-foreground" };
  if (row.paidOff) return { label: "Paid", className: "text-green-700" };
  if (row.partiallyPaid) return { label: "Partial", className: "text-amber-700" };
  return { label: "Unpaid", className: "text-muted-foreground" };
}

const AGEING_CELLS = [
  { key: "0_30", label: "0–30 days" },
  { key: "30_45", label: "31–45 days" },
  { key: "45_60", label: "46–60 days" },
  { key: "60_plus", label: "61+ days" },
] as const;

const amt = (n: number | null) => (n == null || n === 0 ? "" : rupeesExact(n));

/**
 * Public, no-login customer account statement. Pure presentational server
 * component. Desktop → ledger table; mobile → stacked cards (no horizontal
 * scroll). All amounts use tabular numerals and IST dates.
 */
export function PublicStatementView({ data }: Readonly<{ data: PublicStatement }>) {
  const { company, customer, ledger } = data;
  const sellerName = company.legalName || "Account Statement";
  const sellerAddress = companyAddressLines(company).join("\n");
  const pending = data.paymentsUnderVerification;
  const netBalance = data.totalOutstanding - pending;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 text-foreground sm:px-6 print:py-0">
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-8 print:border-0 print:shadow-none">
        {/* Letterhead */}
        <header className="border-b border-border pb-5">
          <p className="text-lg font-semibold leading-tight text-foreground">{sellerName}</p>
          {sellerAddress ? (
            <p className="mt-1 max-w-md whitespace-pre-line text-[12.5px] leading-relaxed text-muted-foreground">
              {sellerAddress}
            </p>
          ) : null}
          {company.gstin ? (
            <p className="mt-1 text-[12.5px] text-muted-foreground">GSTIN: {company.gstin}</p>
          ) : null}
        </header>

        {/* Title + customer + as-on */}
        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Account statement
            </p>
            <p className="mt-1.5 text-base font-semibold text-foreground">{customer.name}</p>
            {customer.city ? <p className="text-[13px] text-muted-foreground">{customer.city}</p> : null}
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">As on</p>
            <p className="mt-1.5 text-[13px] font-medium tabular-nums">{formatDateTime(data.asOf)}</p>
          </div>
        </div>

        {/* Outstanding + ageing */}
        <section className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
          {pending > 0 ? (
            <dl className="space-y-1.5 text-[13px]">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">Total outstanding (as billed)</dt>
                <dd className="font-medium tabular-nums">{rupeesExact(data.totalOutstanding)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">Less: payments under verification</dt>
                <dd className="font-medium tabular-nums">− {rupeesExact(pending)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-t border-border pt-2">
                <dt className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Net balance
                </dt>
                <dd className="text-xl font-bold tabular-nums">{rupeesExact(netBalance)}</dd>
              </div>
            </dl>
          ) : (
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                Total outstanding
              </span>
              <span className="text-xl font-bold tabular-nums">{rupeesExact(data.totalOutstanding)}</span>
            </div>
          )}
          <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {AGEING_CELLS.map((c) => (
              <div key={c.key} className="rounded-md border border-border bg-card px-3 py-2 text-center">
                <dt className="text-[11px] text-muted-foreground">{c.label}</dt>
                <dd className="mt-0.5 text-[13.5px] font-semibold tabular-nums">
                  {rupeesExact(data.ageing[c.key])}
                </dd>
              </div>
            ))}
          </dl>
          {pending > 0 ? (
            <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
              Ageing is of the outstanding as billed, before payments under verification. Payments you have made
              that are still being verified appear in the ledger below and are reflected in the net balance.
            </p>
          ) : null}
        </section>

        {/* Ledger period note */}
        <p className="mt-6 text-[12px] text-muted-foreground">
          Ledger · {formatDate(ledger.from)} to {formatDate(ledger.to)}
        </p>

        {/* Desktop table */}
        <table className="mt-2 hidden w-full text-[13px] md:table">
          <thead>
            <tr className="border-y border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="py-2 font-semibold">Date</th>
              <th className="py-2 font-semibold">Particulars</th>
              <th className="py-2 font-semibold">Vch/Invoice No.</th>
              <th className="py-2 text-right font-semibold">Debit</th>
              <th className="py-2 text-right font-semibold">Credit</th>
              <th className="py-2 text-right font-semibold">Balance</th>
              <th className="py-2 text-right font-semibold">Paid-off</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            <tr className="border-b border-border/70 bg-muted/20">
              <td className="py-2" colSpan={5}>
                <span className="text-muted-foreground">Opening balance brought forward</span>
              </td>
              <td className="py-2 text-right font-medium">{balanceLabel(ledger.openingBalance)}</td>
              <td className="py-2" />
            </tr>
            {ledger.rows.map((r) => {
              const p = paidOff(r);
              return (
                <tr key={`${r.date}-${r.type}-${r.vchNo ?? ""}-${r.balance}`} className="border-b border-border/60">
                  <td className="py-2 whitespace-nowrap">{formatDate(r.date)}</td>
                  <td className="py-2">{particulars(r)}</td>
                  <td className="py-2">{r.vchNo ?? "—"}</td>
                  <td className="py-2 text-right">{amt(r.debit)}</td>
                  <td className="py-2 text-right">{amt(r.credit)}</td>
                  <td className="py-2 text-right">{balanceLabel(r.balance)}</td>
                  <td className={`py-2 text-right ${p.className}`}>{p.label}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="tabular-nums">
            <tr className="border-t border-border">
              <td className="py-2.5 font-semibold" colSpan={3}>
                Closing balance
              </td>
              <td className="py-2.5 text-right">{rupeesExact(ledger.totals.debit)}</td>
              <td className="py-2.5 text-right">{rupeesExact(ledger.totals.credit)}</td>
              <td className="py-2.5 text-right text-base font-bold">
                {balanceLabel(ledger.totals.closingBalance)}
              </td>
              <td className="py-2.5" />
            </tr>
          </tfoot>
        </table>

        {/* Mobile stacked cards */}
        <div className="mt-3 space-y-2 md:hidden">
          <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 text-[13px]">
            <span className="text-muted-foreground">Opening balance b/f</span>
            <span className="font-semibold tabular-nums">{balanceLabel(ledger.openingBalance)}</span>
          </div>
          {ledger.rows.map((r) => {
            const p = paidOff(r);
            return (
              <div key={`${r.date}-${r.type}-${r.vchNo ?? ""}-${r.balance}`} className="rounded-md border border-border px-3 py-2.5 text-[13px]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{particulars(r)}</p>
                    <p className="text-[11.5px] text-muted-foreground">
                      {formatDate(r.date)}
                      {r.vchNo ? ` · ${r.vchNo}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right tabular-nums">
                    {r.debit ? <p className="text-foreground">{rupeesExact(r.debit)} Dr</p> : null}
                    {r.credit ? <p className="text-foreground">{rupeesExact(r.credit)} Cr</p> : null}
                    <p className="text-[11.5px] text-muted-foreground">Bal {balanceLabel(r.balance)}</p>
                  </div>
                </div>
                {r.type === "Sale" ? (
                  <p className={`mt-1 text-[11.5px] ${p.className}`}>{p.label}</p>
                ) : null}
              </div>
            );
          })}
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2.5 text-[13px] font-semibold">
            <span>Closing balance</span>
            <span className="tabular-nums">{balanceLabel(ledger.totals.closingBalance)}</span>
          </div>
        </div>

        <p className="mt-6 text-[11.5px] leading-relaxed text-muted-foreground">
          This is a live, computer-generated account statement and does not require a signature. Balances update as
          new invoices and payments are recorded.
        </p>
      </div>
    </main>
  );
}
