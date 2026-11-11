import type { PermissionState } from "./sync-core";

export type TrackingHealthItemStatus = "ok" | "warning" | "blocker";

export interface TrackingHealthInput {
  isLocationEnabled: boolean | null;
  foregroundPermission: PermissionState;
  backgroundPermission: PermissionState;
  notificationPermission: PermissionState;
  batteryOptimizationStatus: string | null;
  isConnected: boolean | null;
}

export interface TrackingHealthItem {
  id: "gps" | "foreground_location" | "background_location" | "notifications" | "battery" | "network";
  label: string;
  status: TrackingHealthItemStatus;
  detail: string;
}

export interface StartDayHealthChecklist {
  canStart: boolean;
  summary: "Ready" | "Warnings" | "Action needed";
  items: TrackingHealthItem[];
}

function permissionOk(permission: PermissionState): boolean {
  return permission === "granted";
}

// One builder per row so the top-level function stays flat (SonarQube S3776):
// each row owns its own status/detail logic.
function gpsItem(isLocationEnabled: boolean | null): TrackingHealthItem {
  const off = isLocationEnabled === false;
  return { id: "gps", label: "GPS", status: off ? "blocker" : "ok", detail: off ? "Off" : "On" };
}

function foregroundItem(permission: PermissionState): TrackingHealthItem {
  const ok = permissionOk(permission);
  let status: TrackingHealthItemStatus = "warning";
  if (permission === "denied") status = "blocker";
  else if (ok) status = "ok";
  return { id: "foreground_location", label: "Location", status, detail: ok ? "Allowed" : "Needs permission" };
}

function backgroundItem(permission: PermissionState): TrackingHealthItem {
  // Background "Allow all the time" is ESSENTIAL — the Start-Day gate
  // (permissions.ts) blocks without it, so the checklist must agree.
  const ok = permissionOk(permission);
  return { id: "background_location", label: "Background", status: ok ? "ok" : "blocker", detail: ok ? "Allowed" : "Not allowed" };
}

function notificationsItem(permission: PermissionState): TrackingHealthItem {
  const ok = permissionOk(permission);
  return { id: "notifications", label: "Notifications", status: ok ? "ok" : "warning", detail: ok ? "Allowed" : "Not allowed" };
}

function batteryItem(status: string | null): TrackingHealthItem {
  const optimized = status === "optimized";
  return { id: "battery", label: "Battery", status: optimized ? "warning" : "ok", detail: optimized ? "Optimized" : "Unrestricted" };
}

function networkItem(isConnected: boolean | null): TrackingHealthItem {
  const offline = isConnected === false;
  return { id: "network", label: "Network", status: offline ? "warning" : "ok", detail: offline ? "Offline" : "Connected" };
}

export function buildStartDayHealthChecklist(input: TrackingHealthInput): StartDayHealthChecklist {
  const items: TrackingHealthItem[] = [
    gpsItem(input.isLocationEnabled),
    foregroundItem(input.foregroundPermission),
    backgroundItem(input.backgroundPermission),
    notificationsItem(input.notificationPermission),
    batteryItem(input.batteryOptimizationStatus),
    networkItem(input.isConnected),
  ];

  const canStart = !items.some((item) => item.status === "blocker");
  let summary: "Action needed" | "Warnings" | "Ready";
  if (!canStart) summary = "Action needed";
  else if (items.some((item) => item.status === "warning")) summary = "Warnings";
  else summary = "Ready";

  return { canStart, summary, items };
}
