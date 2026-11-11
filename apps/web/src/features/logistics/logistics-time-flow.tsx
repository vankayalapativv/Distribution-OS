import { fmtTime } from "./logistics-media";
import { isActiveRun, runDuration } from "./logistics-run-format";

/** Start -> End time cell with a duration sub-line. An active run shows a live
 *  "elapsed" instead of an end time. */
export function LogisticsTimeFlow({
  startedAt,
  endedAt,
  status,
}: {
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly status: string;
}) {
  const active = isActiveRun(status, endedAt);
  const dur = runDuration(startedAt, endedAt);
  return (
    <div className="tabular-nums">
      <div className="flex items-center gap-2">
        <span className="font-semibold">{fmtTime(startedAt)}</span>
        <span className="text-muted-foreground">&rarr;</span>
        {active ? (
          <span className="font-semibold text-green-700">live</span>
        ) : (
          <span className="font-semibold">{fmtTime(endedAt as string)}</span>
        )}
      </div>
      {dur && <div className="text-[11px] text-muted-foreground">{dur}{active ? " elapsed" : ""}</div>}
    </div>
  );
}
