"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

type Status = "ok" | "degraded" | "down" | "unknown";
type Cell = "ok" | "degraded" | "down" | "nodata";

interface Component {
  key: string;
  name: string;
  detail: string;
  currentStatus: Status;
  latencyMs: number | null;
  uptimePct: number | null;
  days: { date: string; status: Cell }[];
}
interface Summary {
  overall: "ok" | "degraded" | "down";
  components: Component[];
  windowDays: number;
  generatedAt: string;
  /** True when inside the 9–9 monitoring window (figures are a fresh check). */
  live: boolean;
}
interface Probe {
  apiReachable: boolean;
  summary: Summary | null;
}

const BANNER: Record<
  "ok" | "degraded" | "down" | "loading",
  { headline: string; sub: string; wrap: string; icon: typeof CheckCircle2; iconCls: string }
> = {
  ok: {
    headline: "All systems operational",
    sub: "We're not aware of any issues affecting the system.",
    wrap: "border-emerald-200 bg-emerald-50",
    icon: CheckCircle2,
    iconCls: "text-emerald-600",
  },
  degraded: {
    headline: "Degraded performance",
    sub: "Some components are responding slowly.",
    wrap: "border-amber-200 bg-amber-50",
    icon: AlertTriangle,
    iconCls: "text-amber-600",
  },
  down: {
    headline: "Partial system outage",
    sub: "One or more components are currently unreachable.",
    wrap: "border-red-200 bg-red-50",
    icon: XCircle,
    iconCls: "text-red-600",
  },
  loading: {
    headline: "Checking status…",
    sub: "Fetching the latest system health.",
    wrap: "border-border bg-slate-50",
    icon: CheckCircle2,
    iconCls: "text-slate-400",
  },
};

const CELL: Record<Cell, string> = {
  ok: "bg-emerald-500",
  degraded: "bg-amber-400",
  down: "bg-red-500",
  nodata: "bg-slate-200",
};
const DOT: Record<Status, string> = {
  ok: "bg-emerald-500",
  degraded: "bg-amber-400",
  down: "bg-red-500",
  unknown: "bg-slate-300",
};
const COMPONENT_LABEL: Record<Status, string> = {
  ok: "Operational",
  degraded: "Degraded",
  down: "Down",
  unknown: "No data",
};
const CELL_LABEL: Record<Cell, string> = {
  ok: "No incidents",
  degraded: "Degraded performance",
  down: "Outage",
  nodata: "No data",
};

function prettyDate(date: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(`${date}T00:00:00`));
  } catch {
    return date;
  }
}
function timeIST(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

export function StatusView() {
  const [probe, setProbe] = useState<Probe | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/status", { cache: "no-store" });
      setProbe((await res.json()) as Probe);
    } catch {
      setProbe({ apiReachable: false, summary: null });
    } finally {
      setLoading(false);
      setFetchedAt(new Date().toISOString());
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 60_000); // refresh every 60s
    return () => clearInterval(id);
  }, [load]);

  const summary = probe?.summary ?? null;
  let overall: "ok" | "degraded" | "down" | "loading";
  if (loading) overall = "loading";
  else if (probe && !probe.apiReachable) overall = "down";
  else overall = summary?.overall ?? "down";
  const b = BANNER[overall];
  const BannerIcon = b.icon;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <span className="text-lg font-extrabold tracking-tight text-primary">
          Distribution OS
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          System Status
        </span>
      </div>

      {/* Overall banner */}
      <div className={`flex items-start gap-3 rounded-xl border px-5 py-4 ${b.wrap}`}>
        <BannerIcon className={`mt-0.5 size-5 shrink-0 ${b.iconCls}`} />
        <div className="flex flex-col">
          <span className="text-base font-semibold text-foreground">{b.headline}</span>
          <span className="text-sm text-muted-foreground">{b.sub}</span>
        </div>
      </div>

      {/* Components */}
      <div className="rounded-xl border border-border bg-white">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <span className="text-sm font-semibold text-foreground">System status</span>
          <span className="text-xs text-muted-foreground">Last 90 days</span>
        </div>
        {(summary?.components ?? []).map((c, i) => (
          <div key={c.key} className={`px-5 py-4 ${i > 0 ? "border-t border-border" : ""}`}>
            <div className="mb-2 flex items-center gap-2">
              <span className={`size-2.5 rounded-full ${DOT[c.currentStatus]}`} />
              <span className="text-sm font-medium text-foreground">{c.name}</span>
              <span className="text-xs text-muted-foreground">
                {c.currentStatus !== "down" && c.latencyMs != null ? `· ${c.latencyMs} ms` : `· ${c.detail}`}
              </span>
              <span className="ml-auto text-xs font-medium text-muted-foreground">
                {c.uptimePct == null ? COMPONENT_LABEL[c.currentStatus] : `${c.uptimePct}% uptime`}
              </span>
            </div>
            <div className="flex gap-[2px]">
              {c.days.map((d) => (
                <span
                  key={d.date}
                  title={`${prettyDate(d.date)} — ${CELL_LABEL[d.status]}`}
                  className={`h-8 flex-1 rounded-[2px] ${CELL[d.status]} transition-opacity hover:opacity-70`}
                />
              ))}
            </div>
          </div>
        ))}
        {!loading && !summary && (
          <div className="px-5 py-6 text-sm text-muted-foreground">
            The API is unreachable — live status can’t be loaded right now.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Monitored 9 AM – 9 PM IST
          {summary?.live === false
            ? " · outside monitoring hours"
            : ` · last checked ${timeIST(fetchedAt)} IST`}
        </span>
        <button type="button" onClick={() => void load()} className="font-medium text-primary hover:underline">
          Refresh now
        </button>
      </div>
    </div>
  );
}
