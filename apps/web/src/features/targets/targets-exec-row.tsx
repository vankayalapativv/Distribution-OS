"use client";

import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hasTarget, type ExecutiveTargets } from "./targets-api";
import { TargetProgress } from "./target-progress";

function targetButtonLabel(hasTarget: unknown, isFuture: boolean): string {
  if (hasTarget) return "Edit target";
  return isFuture ? "Set upcoming" : "Set target";
}

/** One SE's row: name + Set/Edit + Copy buttons, and their period progress. */
export function TargetsExecRow({
  exec,
  canEdit,
  isFuture,
  copied,
  onEdit,
  onCopy,
}: {
  readonly exec: ExecutiveTargets;
  readonly canEdit: boolean;
  readonly isFuture: boolean;
  readonly copied: boolean;
  readonly onEdit: () => void;
  readonly onCopy: () => void;
}) {
  const set = hasTarget(exec.perf);
  return (
    <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center">
      <div className="w-40 shrink-0">
        <p className="truncate text-sm font-semibold text-foreground">{exec.name}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {canEdit ? (
            <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={onEdit}>
              {targetButtonLabel(set, isFuture)}
            </Button>
          ) : null}
          {set ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs text-muted-foreground"
              onClick={onCopy}
              title="Copy this target to paste into another executive or period"
            >
              <Copy className="size-3" />
              {copied ? "Copied ✓" : "Copy"}
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
