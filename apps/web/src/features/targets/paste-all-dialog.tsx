"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TargetsPanelState } from "./use-targets-panel";

/** Confirm overwriting every executive's target for the shown period with the clipboard. */
export function PasteAllDialog({ p }: { readonly p: TargetsPanelState }) {
  const count = p.executives.length;
  return (
    <Dialog open={p.confirmAll} onOpenChange={(o) => !o && p.setConfirmAll(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply to all executives?</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-2 text-sm text-muted-foreground">
          <p>
            The copied targets will overwrite the{" "}
            <span className="font-medium text-foreground">{p.period === "week" ? "weekly" : "monthly"}</span> target of all{" "}
            <span className="font-medium text-foreground">{count}</span> executives for{" "}
            <span className="font-medium text-foreground">{p.label}</span>.
          </p>
          {p.bulkError ? <p className="text-destructive">{p.bulkError}</p> : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => p.setConfirmAll(false)} disabled={p.applyAll.isPending}>Cancel</Button>
          <Button onClick={() => p.clipboard && p.applyAll.mutate(p.clipboard)} disabled={p.applyAll.isPending || !p.clipboard}>
            {p.applyAll.isPending ? "Applying…" : `Apply to ${count}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
