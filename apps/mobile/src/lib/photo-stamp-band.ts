/**
 * Pure helpers for the stamped band: the IST date/time, the reverse-geocode
 * lookup, the source image size, and the text lines burned into the photo.
 */
import { Image } from "react-native";
import { API_BASE_URL } from "./api";
import { useAuth } from "./auth";

/** Context passed by each capture site. */
export interface StampContext {
  userName: string;
  customerName?: string | null;
}

const GEOCODE_TIMEOUT_MS = 3500;

// ── IST date/time (manual UTC+5:30 — avoids Hermes Intl timeZone gaps) ─────────
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function istStamp(): { date: string; time: string } {
  const d = new Date(Date.now() + 5.5 * 60 * 60 * 1000); // shift to IST, read UTC parts
  const date = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  let h = d.getUTCHours();
  const m = d.getUTCMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return { date, time: `${h}:${m} ${ampm}` };
}

/** Reverse-geocode via our Workers proxy; null on offline/timeout/no-key. */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const token = useAuth.getState().token;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE_URL}/geocode/reverse`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ lat, lng }),
      signal: controller.signal,
    });
    const body = (await res.json().catch(() => null)) as { data?: { address?: string | null } } | null;
    return body?.data?.address ?? null;
  } catch {
    return null; // offline / timeout → coords-only
  } finally {
    clearTimeout(timer);
  }
}

/** Natural pixel size of a local image; {0,0} if it can't be read. */
export function imageSize(uri: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (w, h) => resolve({ w, h }),
      () => resolve({ w: 0, h: 0 }),
    );
  });
}

/** Build the band's text lines from what we resolved. */
export function buildLines(
  fix: { latitude: number; longitude: number } | null,
  address: string | null,
  ctx: StampContext,
): string[] {
  // The pin titles the place being visited — the customer's shop. When no
  // customer is linked (adding a customer, or a check-in before one is chosen)
  // fall back to the street address, then to the brand.
  const title = ctx.customerName?.trim() || address || "Sri Aparajitha Automobile";
  const lines = [`📍 ${title}`];
  if (fix) {
    // Don't repeat the address when it's already serving as the title.
    if (address && address !== title) lines.push(address);
    lines.push(`${fix.latitude.toFixed(5)}, ${fix.longitude.toFixed(5)}`);
  } else {
    lines.push("Location unavailable");
  }
  const { date, time } = istStamp();
  lines.push(`${date} · ${time} · ${ctx.userName}`);
  return lines;
}
