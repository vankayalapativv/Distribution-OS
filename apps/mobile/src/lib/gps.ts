/**
 * Day GPS tracking per GPS-TRACKING.md: a point every 3 minutes, queued in SQLite
 * and batch-synced. The SE ends their own day with the "End day" button (a
 * forgotten day is capped at the next IST midnight); tracking runs to the end of
 * the IST day, no fixed-hour cutoff. Logistics delivery runs share this module
 * with no cap. Preferred mode is a native foreground-service task (survives
 * backgrounding); Expo Go falls back to a foreground watcher.
 *
 * Split by concern to keep each file small; this barrel is the stable `./gps`
 * public entry point. Importing it also registers the background task (via
 * gps-recording, pulled in by gps-start/gps-watchdog below).
 */
export { GPS_TASK, type StartDayResult, type LocationStatus } from "./gps-config";
export { setNativeSignedIn } from "./gps-native";
export { getCheckInFix, reverseGeocodeFix } from "./gps-geocode";
export { startDayTracking } from "./gps-start";
export { stopDayTracking } from "./gps-stop";
export { dayEndedToday, markDayEndedToday } from "./gps-session";
export { getLocationStatus, hasBackgroundLocationPermission, isDayTracking } from "./gps-status";
export { installGpsWatchdog, reconcileServerClosedTrackingSession } from "./gps-watchdog";
