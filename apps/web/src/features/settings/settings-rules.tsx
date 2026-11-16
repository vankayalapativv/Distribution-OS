"use client";

import { Clock, RotateCw } from "lucide-react";
import { PanelHeader, ReadOnlyPill, SettingRow } from "./settings-shared";

/**
 * Business Rules — now entirely system-managed, read-only. Credit control is NO
 * longer an org-wide threshold: ordering is gated per-customer (each customer's
 * own credit days set their invoice due dates, and a customer is blocked once a
 * dues is past due). SUPER_ADMIN can always push orders through. So there is no
 * editable rule here anymore; the panel just surfaces the fixed system rules.
 */
export function RulesPanel() {
  return (
    <div>
      <PanelHeader title="Business Rules" subtitle="System-managed rules that govern orders, credit and field tracking." />

      <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground">
        CREDIT CONTROL <span className="font-normal text-muted-foreground/70">· per customer</span>
      </p>
      <SettingRow
        label="Order credit block"
        description="Sales executives cannot create orders for a customer who owes money and has a dues past its due date (set by that customer's own credit days). Super admins can always place orders."
      >
        <ReadOnlyPill>Per customer</ReadOnlyPill>
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
    </div>
  );
}
