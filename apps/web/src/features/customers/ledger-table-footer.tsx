import { amt, balanceLabel, grandTotalCredit, grandTotalDebit, type LedgerData } from "./ledger-types";

/** The ledger totals footer: period Total, closing Dr/Cr balance, Grand Total. */
export function LedgerTableFooter({ data }: { readonly data: LedgerData }) {
  return (
    <tfoot className="border-t-2 border-border text-sm">
      <tr>
        <td className="px-3 py-2 text-right font-medium text-muted-foreground" colSpan={5}>Total</td>
        <td className="px-3 py-2 text-right font-semibold tabular-nums">{amt(data.totals.debit)}</td>
        <td className="px-3 py-2 text-right font-semibold tabular-nums">{amt(data.totals.credit)}</td>
        <td className="px-3 py-2" colSpan={3} />
      </tr>
      <tr>
        <td className="px-3 pb-2 text-right font-semibold" colSpan={5}>
          {data.totals.closingBalance >= 0 ? "Debit" : "Credit"} Balance
        </td>
        <td className="px-3 pb-2" colSpan={2} />
        <td className="px-3 pb-2 text-right font-bold tabular-nums">{balanceLabel(data.totals.closingBalance)}</td>
        <td className="px-3 pb-2" colSpan={2} />
      </tr>
      <tr className="border-t border-border">
        <td className="px-3 py-2 text-right font-semibold" colSpan={5}>Grand Total</td>
        <td className="px-3 py-2 text-right font-bold tabular-nums">{amt(grandTotalDebit(data))}</td>
        <td className="px-3 py-2 text-right font-bold tabular-nums">{amt(grandTotalCredit(data))}</td>
        <td className="px-3 py-2" colSpan={3} />
      </tr>
    </tfoot>
  );
}
