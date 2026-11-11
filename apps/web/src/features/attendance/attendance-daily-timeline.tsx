"use client";

import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import type { DailyAttendanceRow } from "./attendance-api";
import { hoursLabel, initials, istMinutes, istTime, km } from "./attendance-format";
import { cellHours, odoDistance } from "./attendance-stats";

const AXIS_START = 8 * 60; // 8:00 am
const AXIS_END = 20 * 60; // 8:00 pm
const SPAN = AXIS_END - AXIS_START;
const TICKS = ["8a", "10a", "12p", "2p", "4p", "6p", "8p"];
const TONES = {
  Absent: "bg-muted text-muted-foreground",
  "Week off": "bg-slate-100 text-slate-600",
};

function pct(min: number): number {
  return Math.min(100, Math.max(0, ((min - AXIS_START) / SPAN) * 100));
}

function Row({ r, sunday }: Readonly<{ r: DailyAttendanceRow; sunday: boolean }>) {
  const start = istMinutes(r.startTime);
  const end = istMinutes(r.endTime);
  const hrs = cellHours(r.startTime, r.endTime);
  const dist = odoDistance(r.startOdometer, r.endOdometer);

  return (
    <div className="grid grid-cols-1 items-center gap-3 border-b border-border px-4 py-3 last:border-0 sm:grid-cols-[180px_1fr_120px]">
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full border border-primary/20 bg-primary/10 font-mono text-[11px] font-semibold text-primary">
          {initials(r.name)}
        </span>
        <span className="truncate font-medium">{r.name}</span>
      </div>

      {r.present && start != null ? (
        <div className="relative h-8 rounded-lg border border-border bg-muted/40">
          <div className="pointer-events-none absolute inset-0">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <span key={i} className="absolute inset-y-0 w-px bg-border" style={{ left: `${(i / 7) * 100}%` }} />
            ))}
          </div>
          {end != null ? (
            <div
              className="absolute inset-y-1 flex items-center rounded-md bg-gradient-to-r from-primary to-blue-400 px-2 font-mono text-[11px] font-semibold text-white shadow-sm"
              style={{ left: `${pct(start)}%`, width: `${Math.max(6, pct(end) - pct(start))}%` }}
            >
              {hoursLabel(hrs)}
            </div>
          ) : (
            <div
              className="absolute inset-y-1 flex items-center rounded-md border border-primary/40 bg-primary/15 px-2 font-mono text-[10px] font-semibold text-primary"
              style={{ left: `${pct(start)}%` }}
            >
              {istTime(r.startTime)} →
            </div>
          )}
        </div>
      ) : (
        <div className="flex h-8 items-center rounded-lg border border-border bg-muted/20 px-3">
          <StatusBadge status={sunday ? "Week off" : "Absent"} tones={TONES} />
        </div>
      )}

      <div className="text-xs text-muted-foreground sm:text-right">
        {r.present && start != null ? (
          <>
            <div>
              {istTime(r.startTime)}
              {end != null ? ` – ${istTime(r.endTime)}` : " · no end"}
            </div>
            {dist != null ? <div className="font-mono font-medium text-foreground">{km(dist)}</div> : null}
          </>
        ) : (
          <span className="text-muted-foreground/60">no ping</span>
        )}
      </div>
    </div>
  );
}

/** Daily field timeline: each SE's start → end on an 8am–8pm axis. */
export function AttendanceDailyTimeline({
  rows,
  isLoading,
  isError,
  sunday = false,
}: Readonly<{
  rows: DailyAttendanceRow[];
  isLoading: boolean;
  isError: boolean;
  sunday?: boolean;
}>) {
  let body: ReactNode;
  if (isLoading) {
    body = Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="grid grid-cols-[180px_1fr_120px] items-center gap-3 border-b border-border px-4 py-3 last:border-0">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="ml-auto h-8 w-20" />
      </div>
    ));
  } else if (rows.length === 0) {
    body = (
      <div className="px-4 py-10 text-center text-sm text-muted-foreground">
        {isError ? "Couldn't load attendance." : "No active sales executives."}
      </div>
    );
  } else {
    body = (
      <>
        {rows.map((r) => (
          <Row key={r.userId} r={r} sunday={sunday} />
        ))}
        <div className="hidden grid-cols-[180px_1fr_120px] gap-3 px-4 pb-2 pt-1 sm:grid">
          <span aria-hidden />
          <div className="grid grid-cols-7 font-mono text-[10px] text-muted-foreground/70">
            {TICKS.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
          <span aria-hidden />
        </div>
      </>
    );
  }

  return <div className="rounded-xl border border-border bg-card shadow-sm">{body}</div>;
}
