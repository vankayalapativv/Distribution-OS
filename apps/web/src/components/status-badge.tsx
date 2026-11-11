/**
 * Rounded status pill. Pass a `tones` map (status → tailwind classes) for the
 * feature's palette; unknown statuses fall back to a neutral muted style.
 */

const DEFAULT_TONE = "bg-muted text-muted-foreground";

export function StatusBadge({
  status,
  tones,
}: {
  readonly status: string;
  readonly tones?: Record<string, string>;
}) {
  const tone = tones?.[status] ?? DEFAULT_TONE;
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${tone}`}>
      {status}
    </span>
  );
}
