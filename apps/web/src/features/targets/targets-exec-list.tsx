"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { TargetsExecRow } from "./targets-exec-row";
import type { TargetsPanelState } from "./use-targets-panel";

/** The panel body: loading / error / empty states, else one row per executive. */
export function TargetsExecList({ p }: { readonly p: TargetsPanelState }) {
  if (p.query.isLoading) {
    return (
      <div className="space-y-4 p-5">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }
  if (p.query.isError) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Couldn&apos;t load targets.{" "}
        <button type="button" className="font-medium text-primary underline" onClick={() => void p.query.refetch()}>
          Try again
        </button>
      </p>
    );
  }
  if (p.executives.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {p.isPast ? "No targets were set for this period." : "No active sales executives."}
      </p>
    );
  }
  return (
    <div className="divide-y divide-border">
      {p.executives.map((exec) => (
        <TargetsExecRow
          key={exec.userId}
          exec={exec}
          canEdit={p.canEdit}
          isFuture={p.isFuture}
          copied={p.copiedId === exec.userId}
          onEdit={() => p.setEditing(exec)}
          onCopy={() => p.copyRow(exec)}
        />
      ))}
    </div>
  );
}
