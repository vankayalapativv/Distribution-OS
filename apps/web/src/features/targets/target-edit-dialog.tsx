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
import type { ExecutiveTargets, TargetPeriod, TargetValues } from "./targets-api";

/** Set/edit one SE's per-segment oil litres for a period. */
export function TargetEditDialog({
  actionConfig,
  executive,
  period,
  periodStart,
  isFuture,
  clipboard,
  onCopy,
  onClose,
}: Readonly<{
  actionConfig: ActionConfig;
  executive: ExecutiveTargets;
  period: TargetPeriod;
  /** The selected period's start (yyyy-MM-dd) — written as `periodDate`. */
  periodStart: string;
  isFuture: boolean;
  /** Shared in-app clipboard (from the panel) — enables Paste across execs/periods. */
  clipboard: TargetValues | null;
  onCopy: (values: TargetValues) => void;
  onClose: () => void;
}>) {
  const f = useTargetForm(actionConfig, executive, period, periodStart, onCopy, onClose);

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
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Oil litres by segment</p>
              {isFuture && f.copyable ? (
                <Button type="button" variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={f.copyFromCurrent}>
                  Copy from current {period}
                </Button>
              ) : null}
            </div>
            <TargetSegmentInputs segments={f.segments} onChange={f.setSegment} />
          </div>

          {f.error ? <p className="text-sm text-destructive">{f.error}</p> : null}
        </DialogBody>

        <DialogFooter className="sm:justify-between">
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={f.handleCopy}>
              {f.copied ? "Copied ✓" : "Copy"}
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={!clipboard} onClick={() => clipboard && f.fillFrom(clipboard)}>
              Paste
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={f.save.isPending}>Cancel</Button>
            <Button onClick={() => f.save.mutate()} disabled={f.save.isPending}>
              {f.save.isPending ? "Saving…" : "Save target"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
