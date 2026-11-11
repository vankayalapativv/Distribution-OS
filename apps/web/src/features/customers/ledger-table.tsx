"use client";

import { LedgerSkeletonRows } from "./ledger-skeleton-rows";
import { LedgerTableRow, type LedgerRowHandlers } from "./ledger-table-row";
import { LedgerTableFooter } from "./ledger-table-footer";
import { balanceLabel, fmtDate, type LedgerData } from "./ledger-types";

const HEADERS = ["Date", "Type", "Vch No.", "Particulars", "Narration"];

/** The running-balance ledger table: header, opening-balance row, transaction
 *  rows (or skeleton / empty), and the totals + grand-total footer. */
export function LedgerTable({
  data,
  showSkeleton,
  empty,
  canViewProof,
  canEditEntries,
  handlers,
}: {
  readonly data: LedgerData | undefined;
  readonly showSkeleton: boolean;
  readonly empty: boolean;
  readonly canViewProof: boolean;
  readonly canEditEntries: boolean;
  readonly handlers: LedgerRowHandlers;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-white shadow-sm">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            {HEADERS.map((h) => (
              <th key={h} className="px-3 py-2.5 font-medium">{h}</th>
            ))}
            <th className="px-3 py-2.5 text-right font-medium">Debit (₹)</th>
            <th className="px-3 py-2.5 text-right font-medium">Credit (₹)</th>
            <th className="px-3 py-2.5 text-right font-medium">Balance (₹)</th>
            <th className="px-3 py-2.5 text-right font-medium">Paid off</th>
            <th className="w-10 px-3 py-2.5" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {!showSkeleton && data ? (
            <tr className="border-b border-border bg-muted/30 text-xs">
              <td className="px-3 py-2 font-medium text-muted-foreground" colSpan={7}>
                Opening Balance (before {fmtDate(data.from)})
              </td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">
                {balanceLabel(data.openingBalance)}
              </td>
              <td className="px-3 py-2" colSpan={2} />
            </tr>
          ) : null}

          {(() => { if (showSkeleton) return (
            <LedgerSkeletonRows />
          ); if (empty) return (
            <tr>
              <td className="px-3 py-8 text-center text-sm text-muted-foreground" colSpan={10}>
                No transactions in this period.
              </td>
            </tr>
          ); return (
            data?.rows.map((r) => (
              <LedgerTableRow
                key={`${r.date}-${r.vchNo ?? r.type}-${r.balance}`}
                row={r}
                canViewProof={canViewProof}
                canEditEntries={canEditEntries}
                handlers={handlers}
              />
            ))
          ); })()}
        </tbody>
        {!showSkeleton && data && data.rows.length > 0 ? <LedgerTableFooter data={data} /> : null}
      </table>
    </div>
  );
}
