"use client";

import { Users } from "lucide-react";
import { Shimmer } from "@/components/ui/shimmer";
import { type AgentRow, type MetricKey } from "./metrics-helpers";
import { agentRowContent } from "./agent-row-content";

function agentNameClass(metric: string, live: boolean | undefined): string {
  if (metric !== "executives") return "text-foreground";
  return live ? "text-green-600" : "text-muted-foreground";
}

/** Loading placeholder mirroring an executive row: avatar + name/sub + value. */
function AgentSkeleton() {
  return (
    <div aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5">
          <Shimmer className="h-8 w-8 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Shimmer className="h-3.5 w-40" />
            <Shimmer className="h-3 w-28" />
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Shimmer className="h-3.5 w-12" />
            <Shimmer className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Avatar({ name }: { readonly name: string }) {
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
      {initials || <Users size={13} />}
    </span>
  );
}

/** First drill-down level: one row per sales executive for the chosen metric. */
export function AgentLevel({
  metric,
  agents,
  onOpen,
}: {
  readonly metric: MetricKey;
  readonly agents: AgentRow[] | null;
  readonly onOpen: (row: AgentRow) => void;
}) {
  if (agents === null) return <AgentSkeleton />;
  if (agents.length === 0) {
    return <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nothing recorded in this period.</p>;
  }
  return (
    <div>
      {agents.map((a) => {
        const { secondary, value, sub } = agentRowContent(metric, a);
        return (
          <button
            key={a.agentId}
            type="button"
            onClick={() => onOpen(a)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
          >
            <Avatar name={a.agentName} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">{a.agentName}</span>
              <span className="block text-xs text-muted-foreground">{secondary}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="text-right">
                <span
                  className={`block text-sm font-bold tabular-nums ${
                    agentNameClass(metric, a.live)
                  }`}
                >
                  {value}
                </span>
                {sub ? <span className="block text-[11px] text-muted-foreground">{sub}</span> : null}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
