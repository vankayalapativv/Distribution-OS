"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type ActionConfig } from "@/lib/api-client";
import { TargetSegmentInputs } from "./target-segment-inputs";
import { useTargetForm } from "./use-target-form";
import type { ExecutiveTargets, TargetPeriod } from "./targets-api";

/** Set/edit one SE's per-segment oil litres for a period. */
export function TargetEditDialog({
  actionConfig,
  executive,
  period,
  periodStart,
  onClose,
}: Readonly<{
  actionConfig: ActionConfig;
  executive: ExecutiveTargets;
  period: TargetPeriod;
  /** The selected period's start (yyyy-MM-dd) — written as `periodDate`. */
  periodStart: string;
  onClose: () => void;
}>) {
  const f = useTargetForm(actionConfig, executive, period, periodStart, onClose);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{executive.name} — {period === "week" ? "weekly" : "monthly"} target</DialogTitle>
          <DialogDescription>
            Period starting {periodStart}. Oil litres per segment. Blank or 0 means no target.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Oil litres by segment</p>
            <TargetSegmentInputs segments={f.segments} onChange={f.setSegment} />
          </div>

          {f.error ? <p className="text-sm text-destructive">{f.error}</p> : null}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={f.save.isPending}>Cancel</Button>
          <Button onClick={() => f.save.mutate()} disabled={f.save.isPending}>
            {f.save.isPending ? "Saving…" : "Save target"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
