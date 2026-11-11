"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ATTENDANCE_STATUS_META,
  ATTENDANCE_STATUS_ORDER,
  type AttendanceCell,
  type AttendanceStatus,
} from "./attendance-api";
import { dayLabel, hoursLabel, istTime, km } from "./attendance-format";
import { cellHours, odoDistance } from "./attendance-stats";

export interface EditTarget {
  userId: string;
  name: string;
  cell: AttendanceCell;
}

/** Solid status dot colours for the picker (semantic, not the accent). */
const STATUS_DOT: Record<AttendanceStatus, string> = {
  present: "bg-green-500",
  absent: "bg-red-500",
  half_day: "bg-amber-500",
  leave: "bg-indigo-500",
  week_off: "bg-slate-400",
  holiday: "bg-purple-500",
};

/** The GPS reference for a cell — a bordered readout, matching the Calendar-Grid design. */
function TrackedReadout({ cell }: Readonly<{ cell: AttendanceCell }>) {
  const hrs = cellHours(cell.startTime, cell.endTime);
  const dist = odoDistance(cell.startOdometer, cell.endOdometer);
  return (
    <div className="space-y-1 rounded-lg border border-border bg-muted/40 p-3 text-sm">
      {cell.tracked ? (
        <>
          <p className="text-foreground">
            Started <span className="font-semibold">{cell.startTime ? istTime(cell.startTime) : "—"}</span> · Ended{" "}
            <span className="font-semibold">{cell.endTime ? istTime(cell.endTime) : "—"}</span>
          </p>
          <p className="text-muted-foreground">
            On field <span className="font-semibold text-foreground">{hoursLabel(hrs)}</span> ·{" "}
            <span className="font-semibold text-foreground">{dist != null ? km(dist) : "—"}</span>
          </p>
        </>
      ) : (
        <p className="text-muted-foreground">No GPS tracking this day — set manually.</p>
      )}
      <p className="text-xs text-muted-foreground">
        {cell.manual ? "Currently set manually." : "Currently derived from tracking."}
      </p>
    </div>
  );
}

/** Super-Admin editor for one attendance cell: readout + status grid + note + revert. */
export function CellEditDialog({
  target,
  onClose,
  onSave,
  onClear,
  onHolidayAll,
  saving,
  error,
}: Readonly<{
  target: EditTarget | null;
  onClose: () => void;
  onSave: (status: AttendanceStatus, note: string) => void;
  onClear: () => void;
  onHolidayAll: (note: string) => void;
  saving: boolean;
  error: string | null;
}>) {
  const [status, setStatus] = useState<AttendanceStatus>("present");
  const [note, setNote] = useState("");
  const [seed, setSeed] = useState<string | null>(null);

  // Seed the form once per opened cell.
  const key = target ? `${target.userId}|${target.cell.date}` : null;
  if (key && key !== seed) {
    setSeed(key);
    setStatus(target!.cell.status ?? "present");
    setNote(target!.cell.note ?? "");
  }
  if (!target && seed !== null) setSeed(null);

  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>
            {target?.name} · {target ? dayLabel(target.cell.date) : ""}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {target ? <TrackedReadout cell={target.cell} /> : null}
          <div className="grid grid-cols-2 gap-2">
            {ATTENDANCE_STATUS_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={cn(
                  "flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors",
                  status === s
                    ? "border-primary bg-primary/5 ring-2 ring-primary"
                    : "border-border text-foreground hover:bg-accent",
                )}
              >
                <span className={cn("size-2.5 rounded-full", STATUS_DOT[s])} aria-hidden />
                {ATTENDANCE_STATUS_META[s].label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onHolidayAll(note)}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-purple-300 bg-purple-50 px-3 py-2 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-100 disabled:opacity-50"
          >
            <span className="size-2.5 rounded-full bg-purple-500" aria-hidden />
            Mark {target ? dayLabel(target.cell.date) : "this day"} a holiday for all SEs
          </button>
          <div className="space-y-1.5">
            <label htmlFor="attendance-note" className="text-xs font-medium text-muted-foreground">
              Note (optional)
            </label>
            <Input
              id="attendance-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. approved leave"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </DialogBody>
        <DialogFooter>
          {target?.cell.manual ? (
            <Button variant="ghost" className="mr-auto text-muted-foreground" disabled={saving} onClick={onClear}>
              Revert to tracked
            </Button>
          ) : null}
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => onSave(status, note)} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
