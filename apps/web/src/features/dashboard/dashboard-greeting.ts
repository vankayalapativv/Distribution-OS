import type { WebDashboardRole } from "./dashboard-experience-types";

export const ROLE_DISPLAY: Record<WebDashboardRole, string> = {
  SUPER_ADMIN: "Super Admin",
  MANAGER: "Manager",
  ACCOUNTANT: "Accountant",
};

/** The signed-in user's own name, or the role label when no name is available. */
export function displayName(role: WebDashboardRole, userName?: string): string {
  return userName?.trim() || ROLE_DISPLAY[role];
}

// Single-client Hyderabad deployment → all dashboard dates/times are IST.
// This header renders in a SERVER component (Cloudflare Workers = UTC), so we
// must pin the timezone explicitly; a bare `new Date().getHours()` would read
// UTC and, just after IST midnight, greet "Good evening" on yesterday's date.
const IST_TIME_ZONE = "Asia/Kolkata";

/** Time-of-day greeting in IST (India Standard Time). */
export function getTimeGreeting(): string {
  const h = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: IST_TIME_ZONE,
      hour: "numeric",
      hourCycle: "h23", // 00–23, so midnight is 0 (never 24)
    })
      .formatToParts(new Date())
      .find((p) => p.type === "hour")?.value ?? "0",
  );
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** Long, human date for the dashboard header (en-IN, IST). */
export function getFormattedDate(): string {
  return new Date().toLocaleDateString("en-IN", {
    timeZone: IST_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
