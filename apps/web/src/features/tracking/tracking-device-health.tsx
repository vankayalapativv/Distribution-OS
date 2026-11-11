"use client";

import type { DeviceHealth } from "./tracking-api";
import { sortDeviceRows } from "./tracking-device-health-logic";
import { TrackingDeviceHealthRow } from "./tracking-device-health-row";

const COLS = ["Executive", "Device", "Coverage today", "Last ping", "Checks", "Battery"];

/** Device-health roster: every tracked phone, worst-first, with the failing signals. */
export function TrackingDeviceHealth({ devices }: { readonly devices: DeviceHealth[] }) {
  const rows = sortDeviceRows(devices);

  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 bg-muted/60 text-left text-xs text-muted-foreground">
          <tr>
            {COLS.map((c) => (
              <th key={c} className="px-3 py-2 font-medium">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <TrackingDeviceHealthRow key={row.d.userId} row={row} />
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">No tracked field staff.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
