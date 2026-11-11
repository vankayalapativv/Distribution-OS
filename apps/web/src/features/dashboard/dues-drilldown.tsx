"use client";

/** Per-bucket drill-down for the Collection Dues card: the customers whose
 *  oldest unpaid invoice falls in that age band. Context-aware table skeleton
 *  while loading; customer name links to the customer page. */
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AnimatedSwap } from "@/components/ui/animated-swap";
import type { DuesBucket, DuesCustomerRow } from "./dues-helpers";
import { DuesSkeleton, DuesTable } from "./dues-drilldown-table";

export { useDuesDrilldown } from "./use-dues-drilldown";

/** AnimatedSwap key for the dues drill-down (error / load / empty / data). Pure. */
export function duesSwapKey(error: string | null, rows: DuesCustomerRow[] | null): string {
  if (error) return "error";
  if (!rows) return "load";
  return rows.length === 0 ? "empty" : "data";
}

function DuesContent({ error, rows, skelRows }: Readonly<{ error: string | null; rows: DuesCustomerRow[] | null; skelRows: number }>) {
  if (error) return <p className="px-4 py-6 text-center text-sm text-destructive">{error}</p>;
  if (!rows) return <DuesSkeleton rows={skelRows} />;
  if (rows.length === 0) return <p className="px-4 py-8 text-center text-sm text-muted-foreground">No customers in this age band.</p>;
  return <DuesTable rows={rows} />;
}

export function DuesDrilldownDialog({
  bucket,
  rows,
  error,
  onOpenChange,
}: {
  readonly bucket: DuesBucket | null;
  readonly rows: DuesCustomerRow[] | null;
  readonly error: string | null;
  readonly onOpenChange: (open: boolean) => void;
}) {
  // Match the clicked bucket's customer count, capped at 6, so the shimmer is
  // ~the size of the incoming list and the swap barely resizes.
  const skelRows = bucket ? Math.max(1, Math.min(bucket.customers, 6)) : 6;

  return (
    <Dialog open={bucket !== null} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        {bucket ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-base">Collection dues · {bucket.label}</DialogTitle>
            </DialogHeader>
            <DialogBody className="px-2 py-2">
              <AnimatedSwap swapKey={duesSwapKey(error, rows)}>
                <DuesContent error={error} rows={rows} skelRows={skelRows} />
              </AnimatedSwap>
            </DialogBody>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
