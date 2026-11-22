"use client";

import { Button } from "@/components/ui/button";
import { hasTarget, type ExecutiveTargets } from "./targets-api";
import { TargetProgress } from "./target-progress";

function targetButtonLabel(hasTarget: unknown, isFuture: boolean): string {
  if (hasTarget) return "Edit target";
  return isFuture ? "Set upcoming" : "Set target";
}

/** One SE's row: name + Set/Edit button, and their period progress. */
export function TargetsExecRow({
  exec,
  canEdit,
  isFuture,
  onEdit,
}: {
  readonly exec: ExecutiveTargets;
  readonly canEdit: boolean;
  readonly isFuture: boolean;
  readonly onEdit: () => void;
}) {
  const set = hasTarget(exec.perf);
  return (
    <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center">
      <div className="w-40 shrink-0">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-foreground">{exec.name}</p>
          {set && exec.perf.oilTargetInherited ? (
            <span
              className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
              title="Carried forward from an earlier period — it stays in effect until you set a new one. Edit to set a target for this period."
            >
              Inherited
            </span>
          ) : null}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {canEdit ? (
            <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={onEdit}>
              {targetButtonLabel(set, isFuture)}
            </Button>
          ) : null}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <TargetProgress progress={exec.perf} targetOnly={isFuture} />
      </div>
    </div>
  );
}
