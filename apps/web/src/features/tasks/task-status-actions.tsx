"use client";

/** Status transition buttons for a task: Start / Mark done / Reopen / Cancel,
 *  shown per the current status. */
export function TaskStatusActions({ status, onChange }: { readonly status: string; readonly onChange: (status: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {status !== "in_progress" && status !== "done" ? (
        <button onClick={() => onChange("in_progress")}
          className="rounded-md bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-600/20 hover:bg-blue-100">
          Start
        </button>
      ) : null}
      {status !== "done" ? (
        <button onClick={() => onChange("done")}
          className="rounded-md bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 ring-1 ring-green-600/20 hover:bg-green-100">
          Mark done
        </button>
      ) : (
        <button onClick={() => onChange("open")}
          className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">
          Reopen
        </button>
      )}
      {status !== "cancelled" && status !== "done" ? (
        <button onClick={() => onChange("cancelled")}
          className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-200">
          Cancel task
        </button>
      ) : null}
    </div>
  );
}
