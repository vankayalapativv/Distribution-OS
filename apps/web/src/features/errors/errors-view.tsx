"use client";

import { useCallback, useMemo, useState } from "react";
import { Bug } from "lucide-react";
import { DashboardShell } from "@/features/shell/dashboard-shell";
import { PageHeader } from "@/components/page-header";
import { apiRequest, errorMessage } from "@/lib/api-client";
import type {
  ErrorAssignee,
  ErrorGroupRow,
  ErrorSummary,
} from "./errors-api";
import { ErrorDetailDrawer } from "./error-detail-drawer";
import { relativeTime, SOURCE_STYLE, STATUS_STYLE } from "./errors-shared";

export interface ErrorsActionConfig {
  apiBaseUrl: string;
  authToken: string;
  currentUserId: string;
}

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "resolved", label: "Resolved" },
  { key: "ignored", label: "Ignored" },
  { key: "all", label: "All" },
];

const SOURCES = ["all", "api", "web", "mobile"] as const;

export function ErrorsView({
  summary: initialSummary,
  groups: initialGroups,
  assignees,
  actionConfig,
}: {
  readonly summary: ErrorSummary;
  readonly groups: ErrorGroupRow[];
  readonly assignees: ErrorAssignee[];
  readonly actionConfig: ErrorsActionConfig;
}) {
  const [summary, setSummary] = useState(initialSummary);
  const [groups, setGroups] = useState(initialGroups);
  const [status, setStatus] = useState("open");
  const [source, setSource] = useState<(typeof SOURCES)[number]>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refresh = useCallback(
    async (nextStatus = status, nextSource = source) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ status: nextStatus, source: nextSource });
        const [list, sum] = await Promise.all([
          apiRequest<{ groups: ErrorGroupRow[] }>(actionConfig, "GET", `/errors?${params}`),
          apiRequest<ErrorSummary>(actionConfig, "GET", "/errors/summary"),
        ]);
        setGroups(list.groups);
        setSummary(sum);
      } catch (e) {
        setError(errorMessage(e, "Couldn't load errors."));
      } finally {
        setLoading(false);
      }
    },
    [actionConfig, status, source],
  );

  const onStatus = (key: string) => {
    setStatus(key);
    void refresh(key, source);
  };
  const onSource = (s: (typeof SOURCES)[number]) => {
    setSource(s);
    void refresh(status, s);
  };

  const cards = useMemo(
    () => [
      { label: "Open", value: summary.open.groups, sub: `${summary.open.events} events`, tone: "text-red-600" },
      { label: "Resolved", value: summary.resolved.groups, sub: `${summary.resolved.events} events`, tone: "text-emerald-600" },
      { label: "Ignored", value: summary.ignored.groups, sub: `${summary.ignored.events} events`, tone: "text-muted-foreground" },
      { label: "Last seen", value: summary.lastSeen ? relativeTime(summary.lastSeen) : "—", sub: "most recent open error", tone: "text-foreground", small: true },
    ],
    [summary],
  );

  return (
    <>
      <DashboardShell role="SUPER_ADMIN" active="errors">
        <PageHeader
          title="Error Monitor"
          subtitle="Errors captured across the API, web, and mobile apps — grouped, triaged, and yours to resolve."
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="rounded-lg border border-border bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{c.label}</p>
              <p className={`mt-1 font-semibold tabular-nums ${c.tone} ${c.small ? "text-lg" : "text-3xl"}`}>{c.value}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{c.sub}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border border-border bg-white p-0.5">
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => onStatus(t.key)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  status === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Source</span>
            {SOURCES.map((s) => (
              <button
                key={s}
                onClick={() => onSource(s)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                  source === s ? "bg-foreground text-background" : "border border-border bg-white text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5">Source</th>
                <th className="px-4 py-2.5">Error</th>
                <th className="px-4 py-2.5 text-right">Count</th>
                <th className="px-4 py-2.5">Last seen</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Assignee</th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-14 text-center text-muted-foreground">
                    {loading ? "Loading…" : "No errors here. Nothing to fix — nice."}
                  </td>
                </tr>
              ) : (
                groups.map((g) => (
                  <tr
                    key={g.id}
                    onClick={() => setSelectedId(g.id)}
                    className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-accent/50"
                  >
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${SOURCE_STYLE[g.source]}`}>
                        {g.source}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="line-clamp-1 font-medium text-foreground">{g.title}</p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {g.kind ? `${g.kind} · ` : ""}{g.sampleRoute ?? ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{g.occurrenceCount}</td>
                    <td className="px-4 py-3 text-muted-foreground">{relativeTime(g.lastSeenAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${STATUS_STYLE[g.status]}`}>
                        {g.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{g.assignedToName ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Bug size={13} /> Server errors are captured automatically; web &amp; mobile report to <code className="rounded bg-muted px-1">/errors/ingest</code>.
        </p>
      </DashboardShell>

      {selectedId ? (
        <ErrorDetailDrawer
          groupId={selectedId}
          actionConfig={actionConfig}
          assignees={assignees}
          onClose={() => setSelectedId(null)}
          onChanged={() => void refresh()}
        />
      ) : null}
    </>
  );
}
