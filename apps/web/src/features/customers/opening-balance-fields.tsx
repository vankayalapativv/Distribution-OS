"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { rupees } from "@/lib/format";
import { todayIso, type OpeningBalance } from "./opening-balance-logic";

/** The opening-balance form body: existing-balance summary, a lock note, and the
 *  amount / as-of-date / remarks inputs. All values are controlled by the parent. */
export function OpeningBalanceFields({
  initial,
  locked,
  busy,
  amount,
  setAmount,
  asOfDate,
  setAsOfDate,
  remarks,
  setRemarks,
}: {
  readonly initial: OpeningBalance | null;
  readonly locked: boolean;
  readonly busy: boolean;
  readonly amount: string;
  readonly setAmount: (v: string) => void;
  readonly asOfDate: string;
  readonly setAsOfDate: (v: string) => void;
  readonly remarks: string;
  readonly setRemarks: (v: string) => void;
}) {
  return (
    <>
      <p className="text-sm text-muted-foreground">
        A pre-system carry-forward debt. It counts as the customer&apos;s oldest debt —
        collections pay it off first, then invoices.
      </p>

      {initial ? (
        <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Collected so far</span>
          <span className="text-right font-medium">{rupees(initial.amountCollected)}</span>
          <span className="text-muted-foreground">Still outstanding</span>
          <span className="text-right font-medium">{rupees(initial.outstandingAmount)}</span>
        </div>
      ) : null}

      {locked ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          An opening balance is already set. Only a Super Admin can edit or clear it.
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ob-amount">Opening amount (₹)</Label>
        <Input
          id="ob-amount"
          inputMode="decimal"
          value={amount}
          disabled={locked || busy}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
          placeholder="0.00"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ob-date">As of date</Label>
        <Input
          id="ob-date"
          type="date"
          value={asOfDate}
          disabled={locked || busy}
          max={todayIso()}
          onChange={(e) => setAsOfDate(e.target.value)}
        />
        <span className="text-xs text-muted-foreground">Ages the balance in the dues buckets.</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ob-remarks">Remarks (optional)</Label>
        <Textarea
          id="ob-remarks"
          rows={2}
          value={remarks}
          disabled={locked || busy}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="e.g. BusyWin carry-forward as on 31-Mar"
        />
      </div>
    </>
  );
}
