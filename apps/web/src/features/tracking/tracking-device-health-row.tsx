import { ago, coverage, DOT, type DeviceRow } from "./tracking-device-health-logic";

function Flag({ ok, label }: { readonly ok: boolean; readonly label: string }) {
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
      {label}
    </span>
  );
}

/** One device-health table row: severity + reasons, device, coverage, last ping, checks, battery. */
export function TrackingDeviceHealthRow({ row: { d, sev, reasons } }: { readonly row: DeviceRow }) {
  const cov = coverage(d);
  return (
    <tr className="border-t border-border align-top">
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[sev]}`} />
          <span className="font-medium text-foreground">{d.name}</span>
        </div>
        {reasons.length > 0 && <div className="mt-1 pl-4 text-xs text-red-600">{reasons.join(" · ")}</div>}
      </td>
      <td className="px-3 py-2.5 text-muted-foreground">
        {d.manufacturer || d.model ? (
          <span>{[d.manufacturer, d.model].filter(Boolean).join(" ")}{d.androidVersion ? ` · An${d.androidVersion}` : ""}</span>
        ) : "—"}
        {d.appVersion ? <div className="text-xs text-muted-foreground/70">app {d.appVersion}</div> : null}
      </td>
      <td className="px-3 py-2.5">
        <span className="font-medium text-foreground">{d.todayPoints}</span>
        <span className="text-muted-foreground"> pings</span>
        {cov != null && <span className={cov < 70 ? "text-amber-600" : "text-muted-foreground"}> · {cov}%</span>}
      </td>
      <td className="px-3 py-2.5 text-muted-foreground">{ago(d.lastRecordedAt)}</td>
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap gap-1">
          <Flag ok={d.backgroundPermission === "granted"} label="BG loc" />
          <Flag ok={d.batteryOptimizationStatus === "unrestricted"} label="Batt-opt" />
          <Flag ok={d.isLocationEnabled !== false} label="GPS on" />
          {d.lowPowerMode ? <Flag ok={false} label="Low power" /> : null}
        </div>
      </td>
      <td className="px-3 py-2.5 text-muted-foreground">
        {d.batteryPercentage != null ? `${d.batteryPercentage}%` : "—"}
        {d.networkType ? <div className="text-xs text-muted-foreground/70">{d.networkType}</div> : null}
      </td>
    </tr>
  );
}
