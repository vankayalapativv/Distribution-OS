/** One active session, as returned by the BFF (token stripped server-side). */
export interface AdminSession {
  id: string;
  createdAt: string | null;
  expiresAt: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  /** True for the admin's OWN current session (set by the BFF). */
  current?: boolean;
}

// Ordered match rules — first hit wins (specific engines before the families
// that also appear in their UA strings, e.g. Edge/Opera before Chrome).
const BROWSER_RULES: [RegExp, string][] = [
  [/Edg\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/Chrome\//, "Chrome"],
  [/Firefox\//, "Firefox"],
  [/Safari\//, "Safari"],
];
const OS_RULES: [RegExp, string][] = [
  [/Windows/, "Windows"],
  [/iPhone|iPad|iOS/, "iOS"],
  [/Android/, "Android"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Linux/, "Linux"],
];
const matchLabel = (ua: string, rules: [RegExp, string][], fallback: string): string => {
  for (const [re, label] of rules) if (re.test(ua)) return label;
  return fallback;
};

/** Best-effort device label from a raw user-agent string. Our own clients
 *  report a client library rather than a browser UA: a web login's session is
 *  minted server-side (node/undici) — the login route forwards the browser UA so
 *  new web sessions read as "Chrome on Windows" etc. The Expo app sends a custom
 *  device string on sign-in (`DistributionOS/1.1.2 (Android 13; samsung;
 *  SM-G991B)`), forwarded by the API as the session user-agent, so a phone
 *  session reads as its real model ("Samsung SM-G991B"). Older app builds that
 *  predate that send still arrive as OkHttp → generic "Mobile app (Android)". */
export function describeDevice(ua: string | null): string {
  if (!ua) return "Unknown device";
  const sa = /DistributionOS\/\S+ \(Android [^;]+; ([^;]+); ([^)]+)\)/.exec(ua);
  if (sa) {
    const manufacturer = sa[1].trim();
    const model = sa[2].trim();
    const brand =
      manufacturer && manufacturer.toLowerCase() !== "unknown"
        ? manufacturer.charAt(0).toUpperCase() + manufacturer.slice(1)
        : "";
    const name = brand && !model.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${model}` : model;
    return name || "Mobile app (Android)";
  }
  if (/okhttp/i.test(ua)) return "Mobile app (Android)";
  if (/^node(\s|\/|$)/i.test(ua) || /undici/i.test(ua)) return "Web app";
  const browser = matchLabel(ua, BROWSER_RULES, "Browser");
  const os = matchLabel(ua, OS_RULES, "");
  return os ? `${browser} on ${os}` : browser;
}

export function fmt(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
}

/** Enrich the mobile-app label with the user's known device model when we have
 *  it (from tracking heartbeats), e.g. "Mobile app · Samsung SM-G991B". */
export function sessionLabel(userAgent: string | null, deviceModel: string | null): string {
  if (deviceModel && userAgent && /okhttp/i.test(userAgent)) {
    return `Mobile app · ${deviceModel}`;
  }
  return describeDevice(userAgent);
}
