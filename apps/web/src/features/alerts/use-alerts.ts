"use client";

import { useState } from "react";
import { apiRequest, type ActionConfig } from "@/lib/api-client";
import { useUrlParam } from "@/lib/use-url-state";
import { refreshBadges } from "@/features/shell/badge-refresh";
import type { Alert } from "./alerts-api";

export type AlertStatusFilter = "open" | "all" | "closed";

const STATUSES: readonly AlertStatusFilter[] = ["open", "all", "closed"];

/** Alerts page state: the (locally-updated) alert list, the status filter (in the
 *  URL so Back/refresh restore it — `open` is the default/clean URL), and the
 *  close action (optimistically replaces the alert + refreshes sidebar badges). */
export function useAlerts(initialAlerts: Alert[], actionConfig: ActionConfig) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [statusParam, setStatusParam] = useUrlParam("status", { defaultValue: "open" });
  const statusFilter = (STATUSES as string[]).includes(statusParam)
    ? (statusParam as AlertStatusFilter)
    : "open";
  const setStatusFilter = (next: AlertStatusFilter) => setStatusParam(next === "open" ? null : next);
  const [closingId, setClosingId] = useState<string | null>(null);

  const filtered = statusFilter === "all" ? alerts : alerts.filter((a) => a.status === statusFilter);
  const openCount = alerts.filter((a) => a.status === "open").length;

  async function handleClose(id: string) {
    setClosingId(id);
    try {
      const updated = await apiRequest<Alert>(actionConfig, "POST", `/alerts/${id}/close`);
      setAlerts((prev) => prev.map((a) => (a.id === id ? updated : a)));
      refreshBadges();
    } catch {
      // silent — the alert stays open
    } finally {
      setClosingId(null);
    }
  }

  return { alerts, statusFilter, setStatusFilter, closingId, filtered, openCount, handleClose };
}
