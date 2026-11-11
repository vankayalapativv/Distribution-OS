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
import { rupeesExact } from "@/lib/format";
import type { ActionConfig } from "@/lib/api-client";
import type { Expenditure } from "./expenditures-api";
import { useBillBlob } from "./use-bill-blob";

// Fixed IST so the caption reads the same on server and client.
const RECORDED_AT_FMT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Kolkata",
});

/**
 * Shows an entry's attached bill (image inline, PDF in an iframe). The file is
 * behind auth, so it's fetched as a blob with the bearer token.
 */
export function ExpenditureBillDialog({
  entry,
  onClose,
  actionConfig,
  onEdit,
  onDelete,
}: {
  readonly entry: Expenditure | null;
  readonly onClose: () => void;
  readonly actionConfig: ActionConfig;
  readonly onEdit: (entry: Expenditure) => void;
  readonly onDelete: (entry: Expenditure) => void;
}) {
  const { src, isPdf, failed } = useBillBlob(actionConfig, entry?.id ?? null);

  if (!entry) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>
            {entry.categoryName} · {rupeesExact(entry.amount)}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {entry.expenditureCode} · recorded {RECORDED_AT_FMT.format(new Date(entry.createdAt))}{" "}
            IST
            {entry.paidTo ? ` · paid to ${entry.paidTo}` : ""}
          </p>
        </DialogHeader>

        <DialogBody>
          {(() => { if (failed) return (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Couldn&apos;t load the bill.
            </p>
          ); if (!src) return (
            <div className="h-64 w-full animate-pulse rounded-md bg-slate-200" />
          ); if (isPdf) return (
            <iframe src={src} title="Bill" className="h-[70vh] w-full rounded-md border border-border" />
          ); return (
            <div className="flex max-h-[70vh] items-center justify-center overflow-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="Bill" className="h-auto w-auto max-w-full rounded-md" />
            </div>
          ); })()}
        </DialogBody>

        <DialogFooter>
          <Button variant="destructive" onClick={() => onDelete(entry)}>
            Delete
          </Button>
          <Button variant="outline" onClick={() => onEdit(entry)}>
            Edit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
