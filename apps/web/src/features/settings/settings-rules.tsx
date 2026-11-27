"use client";

import { RotateCw } from "lucide-react";
import { PanelHeader, ReadOnlyPill, SettingRow } from "./settings-shared";

/**
 * Business Rules — all read-only. Credit control is per-customer. Field tracking
 * auto-close is now FIXED for every enterprise (no longer configurable): Sales
 * Executives at 8 PM IST, Logistics at the end of the IST day (midnight). Enforced
 * on device, in ingestion and by cron; the SE's day re-start is blocked until the
 * next day, and both can still end early with the in-app End day / End run button.
 */
export function RulesPanel() {
  return (
    <div>
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
        description="GPS tracking stops for the day at 8:00 PM IST. The SE's day is auto-ended, tracking stops on the device, and they can't start again until tomorrow. Enforced on device, in ingestion and by cron."
      >
        <ReadOnlyPill>8:00 PM IST · fixed</ReadOnlyPill>
      </SettingRow>
      <SettingRow
        label="Logistics tracking auto-stop"
        description="A delivery run keeps tracking through the day and auto-closes at the end of the IST day (12:00 AM). Drivers can also end a run early with End run."
      >
        <ReadOnlyPill>12:00 AM IST · fixed</ReadOnlyPill>
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
