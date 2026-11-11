"use client";

import { CalendarClock } from "lucide-react";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/features/expenditures/expenditure-date-picker";

/** SE reminder block — one cohesive "when to ring their phone" unit (date + time
 *  read as IST, with a live "rings at …" preview). */
export function TaskReminderBlock({
  assigneeName, dueDate, setDueDate, time, setTime, remindPreview,
}: {
  readonly assigneeName: string;
  readonly dueDate: string;
  readonly setDueDate: (v: string) => void;
  readonly time: string;
  readonly setTime: (v: string) => void;
  readonly remindPreview: string | null;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <CalendarClock size={15} className="text-primary" />
        Remind {assigneeName} on their phone
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dueDate">Date *</Label>
          <DatePicker id="dueDate" value={dueDate} onChange={setDueDate} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="time">Time (IST) *</Label>
          <input
            id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {remindPreview ? `Rings at ${remindPreview} (IST) — even if the app is closed.` : "Pick a date and time so it rings at the right moment."}
      </p>
    </div>
  );
}
