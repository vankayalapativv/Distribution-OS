"use client";

/**
 * Cross-tab alerting for the SoundNotifier. When a new order/collection/visit
 * arrives WHILE the dashboard tab is hidden (you're on another tab, or the
 * browser is minimized while you work elsewhere), we:
 *   1. pop a desktop OS notification (if the user granted permission), and
 *   2. flash the tab title + a badged favicon until you return to the tab.
 * A focused tab gets neither — the in-app chime is enough there. No service
 * worker: this only works while the tab is still open (the agreed scope).
 */

let flashTimer: ReturnType<typeof setInterval> | null = null;
let originalTitle: string | null = null;
let originalFavicon: string | null = null;
let unseen = 0;
let phase = false;

/** Ask for OS-notification permission (best from a user gesture); returns the
 *  resulting permission so the caller can enable Web Push on a grant. */
export async function requestNotifyPermission(): Promise<NotificationPermission> {
  try {
    if ("Notification" in window) {
      if (Notification.permission === "default") return await Notification.requestPermission();
      return Notification.permission;
    }
  } catch {
    // some browsers throw if called outside a gesture — safe to ignore
  }
  return "denied";
}

function faviconLink(): HTMLLinkElement {
  let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  return link;
}

/** A red circle stamped with the unseen count — the "badged" favicon. */
function badgeDataUrl(count: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (!ctx) return originalFavicon ?? "";
  ctx.fillStyle = "#dc2626";
  ctx.beginPath();
  ctx.arc(16, 16, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 20px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(count > 9 ? "9+" : String(count), 16, 17);
  return canvas.toDataURL("image/png");
}

function label(): string {
  return unseen === 1 ? "1 new alert" : `${unseen} new alerts`;
}

function stopFlashTimer(): void {
  if (flashTimer) {
    clearInterval(flashTimer);
    flashTimer = null;
  }
}

/** Start (or restart, to refresh the count) the title + favicon flashing. */
function startFlash(): void {
  if (originalTitle === null) originalTitle = document.title;
  if (originalFavicon === null) originalFavicon = faviconLink().getAttribute("href");
  stopFlashTimer();
  const badge = badgeDataUrl(unseen);
  flashTimer = setInterval(() => {
    phase = !phase;
    document.title = phase ? `🔔 ${label()}` : originalTitle ?? "Sri Aparajitha Enterprise";
    faviconLink().setAttribute("href", phase ? badge : originalFavicon ?? "");
  }, 900);
}

/**
 * Signal a new item that arrived while the tab is hidden: OS notification + a
 * fresh flash reflecting the new unseen count. No-op when the tab is visible
 * (the user is already looking — the chime suffices).
 */
export function alertHidden(opts: { title: string; body: string; tag: string }): void {
  if (typeof document === "undefined" || !document.hidden) return;
  unseen += 1;
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(opts.title, { body: opts.body, tag: opts.tag });
    }
  } catch {
    // notification construction can throw on some browsers — ignore
  }
  startFlash();
}

/** Restore the tab (title + favicon) — call when the tab becomes visible. */
export function clearTabAlert(): void {
  stopFlashTimer();
  if (originalTitle !== null) {
    document.title = originalTitle;
    originalTitle = null;
  }
  if (originalFavicon !== null) {
    faviconLink().setAttribute("href", originalFavicon);
    originalFavicon = null;
  }
  unseen = 0;
  phase = false;
}
