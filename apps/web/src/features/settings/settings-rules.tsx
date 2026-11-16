"use client";

import { type SyntheticEvent, useState } from "react";
import { RotateCw } from "lucide-react";
import { type ActionConfig, apiRequest, errorMessage } from "@/lib/api-client";
import {
  PanelHeader,
  ReadOnlyPill,
  type SaveMessage,
  SaveBar,
  SettingRow,
  type SystemSettings,
} from "./settings-shared";

/** "7:00 PM" for hour 19, "9:00 AM" for 9, "12:00 AM" for 0. Whole-hour only. */
function hourLabel(h: number): string {
  const am = h < 12;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:00 ${am ? "AM" : "PM"}`;
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);

/**
 * Business Rules. Credit control is per-customer (read-only). Field tracking:
 * the SE GPS auto-stop hour is editable (whole-hour); Logistics tracking has NO
 * auto-stop (a run ends only on "End run"), so there is no logistics row.
 */
export function RulesPanel({
  systemSettings,
  actionConfig,
}: {
  readonly systemSettings: SystemSettings;
  readonly actionConfig: ActionConfig;
}) {
  const [stopHour, setStopHour] = useState(systemSettings.seTrackingStopHour);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<SaveMessage>(null);

  async function handleSave(e: SyntheticEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await apiRequest(actionConfig, "PATCH", "/system-settings", { seTrackingStopHour: stopHour });
      setMessage({ type: "success", text: "Rules updated." });
    } catch (err) {
      setMessage({ type: "error", text: errorMessage(err, "Failed to save.") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave}>
      <PanelHeader title="Business Rules" subtitle="Rules that govern orders, credit and field tracking." />

      <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground">
        CREDIT CONTROL <span className="font-normal text-muted-foreground/70">· per customer</span>
      </p>
      <SettingRow
        label="Order credit block"
        description="Sales executives cannot create orders for a customer who owes money and has a dues past its due date (set by that customer's own credit days). Super admins can always place orders."
      >
        <ReadOnlyPill>Per customer</ReadOnlyPill>
      </SettingRow>

      <p className="mb-2 mt-6 text-[11px] font-semibold tracking-wide text-muted-foreground">FIELD TRACKING &amp; DUES</p>
      <SettingRow
        label="Sales executive tracking auto-stop"
        description="GPS tracking stops for the day at this time (IST). The SE's day is auto-ended, tracking stops on the device, and they can't start again until tomorrow. Enforced on device, in ingestion and by cron."
      >
        <select
          value={stopHour}
          onChange={(e) => setStopHour(Number(e.target.value))}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Sales executive tracking auto-stop time"
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {hourLabel(h)} IST
            </option>
          ))}
        </select>
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
