"use client";

import { ChevronLeft } from "lucide-react";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AnimatedSwap } from "@/components/ui/animated-swap";
import { METRIC_TITLES, rangeLabel, type AgentRow, type CustomerRow, type MetricKey } from "./metrics-helpers";
import { AgentLevel } from "./metrics-drilldown-agents";
import { CustomerLevel } from "./metrics-drilldown-customers";

export { useDrilldown } from "./use-drilldown";

interface DrilldownProps {
  readonly metric: MetricKey | null;
  readonly range: { from: string; to: string };
  readonly agents: AgentRow[] | null;
  readonly agent: AgentRow | null;
  readonly customerRows: CustomerRow[] | null;
  readonly error: string | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onBack: () => void;
  readonly onOpenAgent: (row: AgentRow) => void;
}

/** The AnimatedSwap key — changes when the shown level (error / customers / agents)
 *  or its load state changes, so the crossfade fires. Pure. */
export function drilldownSwapKey(
  error: string | null, agent: AgentRow | null, customerRows: CustomerRow[] | null, agents: AgentRow[] | null,
): string {
  if (error) return "error";
  if (agent) return `cust-${customerRows === null ? "load" : "data"}`;
  return `agent-${agents === null ? "load" : "data"}`;
}

function DrilldownTitle({ metric, range, agent, onBack }: Readonly<Pick<DrilldownProps, "range" | "agent" | "onBack"> & { metric: MetricKey }>) {
  return (
    <DialogTitle className="flex items-center gap-2 text-base">
      {agent ? (
        <button
          type="button"
          aria-label="Back"
          className="-ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onBack}
        >
          <ChevronLeft size={20} />
        </button>
      ) : null}
      {agent ? `${agent.agentName} — ` : ""}
      {METRIC_TITLES[metric]} · {rangeLabel(range.from, range.to)}
    </DialogTitle>
  );
}

function DrilldownContent({ error, agent, metric, customerRows, agents, onOpenAgent }: Readonly<Pick<DrilldownProps, "error" | "agent" | "customerRows" | "agents" | "onOpenAgent"> & { metric: MetricKey }>) {
  if (error) return <p className="px-4 py-6 text-center text-sm text-destructive">{error}</p>;
  if (agent) return <CustomerLevel metric={metric} rows={customerRows} />;
  return <AgentLevel metric={metric} agents={agents} onOpen={onOpenAgent} />;
}

export function MetricsDrilldownDialog({
  metric, range, agents, agent, customerRows, error, onOpenChange, onBack, onOpenAgent,
}: DrilldownProps) {
  return (
    <Dialog open={metric !== null} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        {metric ? (
          <>
            <DialogHeader>
              <DrilldownTitle metric={metric} range={range} agent={agent} onBack={onBack} />
            </DialogHeader>
            <DialogBody className="px-2 py-2">
              <AnimatedSwap swapKey={drilldownSwapKey(error, agent, customerRows, agents)}>
                <DrilldownContent error={error} agent={agent} metric={metric} customerRows={customerRows} agents={agents} onOpenAgent={onOpenAgent} />
              </AnimatedSwap>
            </DialogBody>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
