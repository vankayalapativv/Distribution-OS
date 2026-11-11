import { formatTime, formatLastSeen, rupeesExact } from "@/lib/format";
import { productivityColor } from "@/lib/productivity";
import { litresLabel, type AgentRow, type MetricKey } from "./metrics-helpers";

export interface AgentRowContent {
  secondary: string;
  value: React.ReactNode;
  sub: string;
}

const customerLabelOf = (a: AgentRow): string => {
  const c = a.customers ?? 0;
  return `${c} customer${c === 1 ? "" : "s"}`;
};

/** Executives metric's primary value — Live, last-seen, or em-dash. */
function execValue(a: AgentRow): React.ReactNode {
  if (a.live) return "Live";
  if (a.lastPingAt) return `seen ${formatLastSeen(a.lastPingAt)}`;
  return "—";
}

function visitsContent(a: AgentRow, metric: "visits" | "productive"): AgentRowContent {
  const avg = a.avgDurationMinutes;
  const avgLabel = avg != null ? ` · avg ${avg} min` : "";
  return {
    secondary: customerLabelOf(a),
    value: metric === "productive" ? (a.productiveVisits ?? 0) : (a.visits ?? 0),
    sub: metric === "visits" ? `${a.productiveVisits ?? 0} productive${avgLabel}` : `of ${a.visits ?? 0} visits`,
  };
}

function productivityContent(a: AgentRow): AgentRowContent {
  const tv = a.visits ?? 0;
  const pv = a.productiveVisits ?? 0;
  const pct = tv > 0 ? Math.round((pv / tv) * 100) : 0;
  const tone = productivityColor(pct);
  return {
    secondary: customerLabelOf(a),
    value: (
      <span className="rounded-md px-2 py-0.5 text-sm font-bold tabular-nums" style={{ backgroundColor: tone.bg, color: tone.fg }}>
        {pct}%
      </span>
    ),
    sub: `${pv} of ${tv} visits`,
  };
}

/** Per-metric row content builders — dispatched by `agentRowContent`. */
const CONTENT_BUILDERS: Record<MetricKey, (a: AgentRow) => AgentRowContent> = {
  executives: (a) => ({
    secondary: a.sessionStartedAt
      ? `day started ${formatTime(a.sessionStartedAt)} · ${a.visits ?? 0} visits`
      : "day not started",
    value: execValue(a),
    sub: "",
  }),
  visits: (a) => visitsContent(a, "visits"),
  productive: (a) => visitsContent(a, "productive"),
  productivity: productivityContent,
  ordered: (a) => ({
    secondary: `${a.orders ?? 0} order${(a.orders ?? 0) === 1 ? "" : "s"} · ${a.customers ?? 0} customers`,
    value: litresLabel(a.litres ?? 0),
    sub: "incl. cancelled",
  }),
  litres: (a) => ({
    secondary: `${a.orders ?? 0} deliver${(a.orders ?? 0) === 1 ? "y" : "ies"} · ${a.customers ?? 0} customers`,
    value: litresLabel(a.litres ?? 0),
    sub: "net of returns",
  }),
  collections: (a) => ({
    secondary: `${a.collections ?? 0} collection${(a.collections ?? 0) === 1 ? "" : "s"} · ${a.customers ?? 0} customers`,
    value: rupeesExact(a.amount ?? 0),
    sub: `${rupeesExact(a.verified ?? 0)} verified`,
  }),
};

/** The secondary line, primary value and sub-line for one executive row, which
 *  differ per metric. Pure — no side effects. */
export function agentRowContent(metric: MetricKey, a: AgentRow): AgentRowContent {
  return CONTENT_BUILDERS[metric](a);
}
