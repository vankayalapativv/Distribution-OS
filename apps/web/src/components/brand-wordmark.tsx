/**
 * The "Distribution OS / Enterprise" wordmark. Presentational (no hooks), so it
 * works in both server and client components — used on the auth, status, and
 * error/not-found pages.
 */
export function BrandWordmark() {
  return (
    <div className="flex flex-col items-center leading-none">
      <span className="text-lg font-extrabold tracking-tight text-primary">Distribution OS</span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        Enterprise
      </span>
    </div>
  );
}
