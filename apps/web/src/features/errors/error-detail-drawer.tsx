"use client";

import { useEffect, useState } from "react";
import { Check, EyeOff, RotateCcw, X } from "lucide-react";
import { SearchSelect } from "@/components/ui/search-select";
import { apiRequest, errorMessage } from "@/lib/api-client";
import type { ErrorsActionConfig } from "./errors-view";
import type { ErrorAssignee, ErrorGroupDetail } from "./errors-api";
import { fullTime, SOURCE_STYLE, STATUS_STYLE } from "./errors-shared";

type ErrorGroup = ErrorGroupDetail["group"];
type ErrorEvent = ErrorGroupDetail["events"][number];

/** The drawer header's group summary (pills + title), or a loading placeholder. */
function HeaderInfo({ g }: Readonly<{ g: ErrorGroup | undefined }>) {
  if (!g) return <h3 className="text-base font-semibold text-muted-foreground">Loading…</h3>;
  return (
    <>
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${SOURCE_STYLE[g.source]}`}>{g.source}</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${STATUS_STYLE[g.status]}`}>{g.status}</span>
        {g.kind ? <span className="text-xs text-muted-foreground">{g.kind}</span> : null}
      </div>
      <h3 className="mt-1.5 break-words text-base font-semibold text-foreground">{g.title}</h3>
    </>
  );
}

/** One row in the "recent occurrences" list. */
function OccurrenceRow({ ev }: Readonly<{ ev: ErrorEvent }>) {
  return (
    <div className="px-3 py-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground">{fullTime(ev.createdAt)}</span>
        <span className="text-muted-foreground">
          {ev.method ? `${ev.method} ` : ""}{ev.route ?? ""}{ev.statusCode ? ` · ${ev.statusCode}` : ""}
        </span>
      </div>
      {(ev.role || ev.appVersion || ev.requestId) ? (
        <p className="mt-0.5 text-muted-foreground">
          {ev.role ? `${ev.role}` : ""}{ev.appVersion ? ` · v${ev.appVersion}` : ""}{ev.requestId ? ` · req ${ev.requestId.slice(0, 8)}` : ""}
        </p>
      ) : null}
    </div>
  );
}

/** The loaded drawer body: meta grid, action bar, stack, occurrences, notes. */
function DetailBody({ g, detail, busy, note, setNote, assignees, onPatch, onAddNote }: Readonly<{
  g: NonNullable<ErrorGroup>;
  detail: ErrorGroupDetail | null;
  busy: boolean;
  note: string;
  setNote: (v: string) => void;
  assignees: ErrorAssignee[];
  onPatch: (body: Record<string, unknown>) => void;
  onAddNote: () => void;
}>) {
  return (
    <>
      {/* meta */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div><dt className="text-xs text-muted-foreground">Occurrences</dt><dd className="font-semibold tabular-nums">{g.occurrenceCount}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Route</dt><dd className="truncate">{g.sampleRoute ?? "—"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">First seen</dt><dd>{fullTime(g.firstSeenAt)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Last seen</dt><dd>{fullTime(g.lastSeenAt)}</dd></div>
      </dl>

      {/* actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button disabled={busy || g.status === "resolved"} onClick={() => onPatch({ status: "resolved" })}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40">
          <Check size={15} /> Resolve
        </button>
        <button disabled={busy || g.status === "ignored"} onClick={() => onPatch({ status: "ignored" })}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-40">
          <EyeOff size={15} /> Ignore
        </button>
        {g.status !== "open" ? (
          <button disabled={busy} onClick={() => onPatch({ status: "open" })}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-40">
            <RotateCcw size={15} /> Reopen
          </button>
        ) : null}
        <div className="ml-auto w-[170px]">
          <SearchSelect
            items={[{ id: "", name: "Unassigned" }, ...assignees.map((a) => ({ id: a.id, name: a.name }))]}
            valueKey={g.assignedTo ?? ""}
            getKey={(x) => x.id}
            getLabel={(x) => x.name}
            onSelect={(v) => onPatch({ assignedTo: v || null })}
            disabled={busy}
            placeholder="Unassigned"
            searchPlaceholder="Search person…"
            emptyText="No one found"
            triggerClassName="!h-8 bg-white"
            contentClassName="w-[220px] p-0"
          />
        </div>
      </div>

      {g.resolvedByName ? (
        <p className="mt-2 text-xs text-emerald-700">Resolved by {g.resolvedByName}{g.resolvedAt ? ` · ${fullTime(g.resolvedAt)}` : ""}.</p>
      ) : null}

      {/* stack */}
      {g.sampleStack ? (
        <div className="mt-5">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Latest stack</p>
          <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-slate-50 p-3 text-xs leading-relaxed text-slate-800">{g.sampleStack}</pre>
        </div>
      ) : null}

      {/* occurrences */}
      <div className="mt-5">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent occurrences ({detail?.events.length ?? 0})</p>
        <div className="divide-y divide-border rounded-lg border border-border">
          {detail?.events.map((ev) => <OccurrenceRow key={ev.id} ev={ev} />)}
        </div>
      </div>

      {/* notes */}
      <div className="mt-5">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</p>
        <div className="flex flex-col gap-2">
          {detail?.notes.map((n) => (
            <div key={n.id} className="rounded-lg border border-border bg-slate-50 px-3 py-2 text-sm">
              <p className="whitespace-pre-wrap text-foreground">{n.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">{n.authorName ?? "—"} · {fullTime(n.createdAt)}</p>
            </div>
          ))}
          {detail && detail.notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          ) : null}
        </div>
        <div className="mt-2 flex gap-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note…"
            rows={2}
            className="flex-1 resize-none rounded-md border border-border px-3 py-2 text-sm"
          />
          <button disabled={busy || !note.trim()} onClick={onAddNote}
            className="self-end rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40">
            Add
          </button>
        </div>
      </div>
    </>
  );
}

export function ErrorDetailDrawer({
  groupId,
  actionConfig,
  assignees,
  onClose,
  onChanged,
}: {
  readonly groupId: string;
  readonly actionConfig: ErrorsActionConfig;
  readonly assignees: ErrorAssignee[];
  readonly onClose: () => void;
  readonly onChanged: () => void;
}) {
  const [detail, setDetail] = useState<ErrorGroupDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const load = async () => {
    setLoadError(null);
    try {
      setDetail(await apiRequest<ErrorGroupDetail>(actionConfig, "GET", `/errors/${groupId}`));
    } catch (e) {
      setLoadError(errorMessage(e, "Couldn't load this error."));
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      await apiRequest(actionConfig, "PATCH", `/errors/${groupId}`, body);
      await load();
      onChanged();
    } catch (e) {
      setLoadError(errorMessage(e, "Update failed."));
    } finally {
      setBusy(false);
    }
  };

  const addNote = async () => {
    const body = note.trim();
    if (!body) return;
    setBusy(true);
    try {
      await apiRequest(actionConfig, "POST", `/errors/${groupId}/notes`, { body });
      setNote("");
      await load();
    } catch (e) {
      setLoadError(errorMessage(e, "Couldn't add note."));
    } finally {
      setBusy(false);
    }
  };

  const g = detail?.group;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}
        role="button" tabIndex={0} aria-label="Close"
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " " || e.key === "Escape") onClose(); }} />
      <div className="relative flex h-full w-full max-w-[640px] flex-col bg-white shadow-xl">
        {/* header */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <HeaderInfo g={g} />
          </div>
          <button onClick={onClose} className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loadError ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</div>
          ) : null}

          {g ? (
            <DetailBody
              g={g}
              detail={detail}
              busy={busy}
              note={note}
              setNote={setNote}
              assignees={assignees}
              onPatch={(body) => void patch(body)}
              onAddNote={() => void addNote()}
            />
          ) : (
            !loadError && <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </div>
      </div>
    </div>
  );
}
