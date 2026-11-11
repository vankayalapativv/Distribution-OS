// Fixed IST date + time so the caption reads the same on server and client
// (no hydration mismatch) and matches the SE's own timezone.
const UPLOADED_AT_FMT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Kolkata",
});

/** e.g. "24 Jul 2026, 4:13 pm IST", or "" for an unparseable date. */
export function formatUploadedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${UPLOADED_AT_FMT.format(d)} IST`;
}
