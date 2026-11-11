import { isActiveRun } from "./logistics-run-format";

/** Run status pill: green "Active" (driver still out) or a neutral "Ended". */
export function LogisticsStatusPill({ status, endedAt }: { readonly status: string; readonly endedAt: string | null }) {
  if (isActiveRun(status, endedAt)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
        <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
      Ended
    </span>
  );
}
