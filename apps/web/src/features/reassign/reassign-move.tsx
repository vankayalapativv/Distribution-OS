"use client";

import { type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { SearchSelect } from "@/features/orders/search-select";
import { ReassignAvatar } from "./reassign-avatar";
import { totalCount } from "./reassign-logic";
import type { MovedCounts, SalesExec } from "./reassign-api";

/** The "Move ownership" block: current owner → reassign-to picker, the "what
 *  moves" grid (passed as children), and the Move-records action bar. */
export function ReassignMove({
  owner,
  targets,
  toUserId,
  setToUserId,
  counts,
  busy,
  onMove,
  children,
}: Readonly<{
  owner: { id: string; name: string };
  targets: SalesExec[];
  toUserId: string;
  setToUserId: (v: string) => void;
  counts: MovedCounts;
  busy: boolean;
  onMove: () => void;
  children?: ReactNode;
}>) {
  const toName = targets.find((t) => t.id === toUserId)?.name ?? "";
  return (
    <div className="space-y-4">
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Move ownership</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div className="rounded-xl border border-amber-500/30 bg-muted/40 p-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-amber-600">Current owner</div>
          <div className="flex items-center gap-2.5">
            <ReassignAvatar id={owner.id} name={owner.name} />
            <div><div className="font-semibold text-card-foreground">{owner.name}</div><div className="text-xs text-muted-foreground">Sales Executive</div></div>
          </div>
        </div>
        <span className="mx-auto grid size-9 place-items-center rounded-full bg-primary text-primary-foreground sm:mx-0"><ArrowRight className="size-4" /></span>
        <div className="rounded-xl border border-primary/30 bg-muted/40 p-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-primary">Reassign to</div>
          <SearchSelect
            items={targets}
            valueKey={toUserId}
            getKey={(t) => t.id}
            getLabel={(t) => t.name}
            onSelect={setToUserId}
            placeholder="Select executive…"
            searchPlaceholder="Search executives…"
            emptyText="No executives"
            contentClassName="w-[280px] p-0"
          />
        </div>
      </div>

      {children}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{owner.name}</span> <ArrowRight className="inline size-3.5" />{" "}
          <span className="font-medium text-foreground">{toName || "…"}</span> · {totalCount(counts)} records re-attributed
        </div>
        <button
          type="button"
          disabled={!toUserId || busy}
          onClick={onMove}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
        >
          Move records <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
