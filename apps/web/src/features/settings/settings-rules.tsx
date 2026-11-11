"use client";

import { type SyntheticEvent, useState } from "react";
import { Clock, RotateCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { type ActionConfig, apiRequest, errorMessage } from "@/lib/api-client";
import {
  PanelHeader,
  ReadOnlyPill,
  type SaveMessage,
  SaveBar,
  SettingRow,
  type SystemSettings,
} from "./settings-shared";

export function RulesPanel({
  systemSettings,
  actionConfig,
}: {
  readonly systemSettings: SystemSettings;
  readonly actionConfig: ActionConfig;
}) {
  const [creditDays, setCreditDays] = useState(String(systemSettings.creditOverdueDays));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<SaveMessage>(null);

  async function handleSave(e: SyntheticEvent) {
    e.preventDefault();
    const days = parseInt(creditDays, 10);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      setMessage({ type: "error", text: "Must be between 1 and 365 days." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await apiRequest(actionConfig, "PATCH", "/system-settings", { creditOverdueDays: days });
      setMessage({ type: "success", text: "Rules updated." });
    } catch (err) {
      setMessage({ type: "error", text: errorMessage(err, "Failed to save.") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave}>
      <PanelHeader title="Business Rules" subtitle="System-wide rules that govern orders, credit and field tracking." />

      <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground">CREDIT CONTROL</p>
      <SettingRow
        label="Credit overdue threshold"
        description="Sales executives cannot create orders for a customer whose invoices are overdue beyond this many days."
      >
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            max={365}
            value={creditDays}
            onChange={(e) => setCreditDays(e.target.value)}
            className="w-20 text-center"
          />
          <span className="text-sm text-muted-foreground">days</span>
        </div>
      </SettingRow>

      <p className="mb-2 mt-6 text-[11px] font-semibold tracking-wide text-muted-foreground">
        FIELD TRACKING &amp; DUES <span className="font-normal text-muted-foreground/70">· system-managed</span>
      </p>
      <SettingRow
        label="Sales executive tracking auto-stop"
        description="GPS tracking stops for the day at this time (IST); enforced on device, in ingestion and by cron."
      >
        <ReadOnlyPill icon={<Clock size={14} className="text-muted-foreground" />}>7:00 PM IST</ReadOnlyPill>
      </SettingRow>
      <SettingRow label="Logistics tracking auto-stop" description="Delivery staff keep a later tracking window.">
        <ReadOnlyPill icon={<Clock size={14} className="text-muted-foreground" />}>9:00 PM IST</ReadOnlyPill>
      </SettingRow>
      <SettingRow
        label="Dues ageing sweep"
        description="A daily cron re-buckets customer collection dues (0–30 / 30–45 / 45–60 / 60+) and notifies the SE on an upward crossing."
      >
        <ReadOnlyPill icon={<RotateCw size={14} className="text-muted-foreground" />}>Daily · after 9 AM IST</ReadOnlyPill>
      </SettingRow>

      <SaveBar saving={saving} message={message} label="Save rules" />
    </form>
  );
}
