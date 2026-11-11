"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, RotateCcw, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SearchSelect } from "@/features/orders/search-select";
import { apiGet, apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import { useUrlState } from "@/lib/use-url-state";
import { formatDate } from "@/lib/format";
import type {
  CustomerPick,
  MovedCounts,
  ReassignHistoryEntry,
  ReassignPreview,
} from "./reassign-api";

const COUNT_LABELS: { key: keyof MovedCounts; label: string }[] = [
  { key: "orders", label: "Orders" },
  { key: "collections", label: "Collections" },
  { key: "invoices", label: "Invoices" },
  { key: "visits", label: "Visits" },
  { key: "photos", label: "Photos" },
  { key: "notes", label: "Notes" },
  { key: "beatDays", label: "Beat days" },
];

function totalCount(c: MovedCounts): number {
  return COUNT_LABELS.reduce((sum, { key }) => sum + c[key], 0);
}

export function ReassignView({
  customers,
  actionConfig,
}: {
  readonly customers: CustomerPick[];
  readonly actionConfig: ActionConfig;
}) {
  // The selected customer lives in the URL (push) so Back closes the preview panel
  // and a refresh/share restores it; its preview loads reactively below.
  const { get, set } = useUrlState();
  const customerId = get("customer");
  const setCustomerId = (id: string) => set({ customer: id || null }, id ? "push" : "replace");
  const [preview, setPreview] = useState<ReassignPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [toUserId, setToUserId] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadPreview = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);
      setNotice(null);
      setToUserId("");
      setConfirming(false);
      try {
        const data = await apiGet<ReassignPreview>(
          actionConfig,
          `/customers/${id}/reassign/preview`,
        );
        setPreview(data);
      } catch (e) {
        setPreview(null);
        setError(errorMessage(e, "Couldn't load this customer's reassignment details."));
      } finally {
        setLoading(false);
      }
    },
    [actionConfig],
  );

  // Load (or clear) the preview whenever the selected customer in the URL changes
  // — covers picking a customer, Back/forward, and a refresh/deep-link.
  useEffect(() => {
    if (customerId) void loadPreview(customerId);
    else setPreview(null);
  }, [customerId, loadPreview]);

  const onPickCustomer = (id: string) => setCustomerId(id);

  async function doReassign() {
    if (!preview || !toUserId) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const entry = await apiRequest<ReassignHistoryEntry>(
        actionConfig,
        "POST",
        `/customers/${preview.customer.id}/reassign`,
        { toUserId },
      );
      setNotice(
        `Reassigned to ${entry.toUserName ?? "the selected executive"} — ${totalCount(entry.counts)} record(s) moved.`,
      );
      await loadPreview(preview.customer.id);
    } catch (e) {
      setError(errorMessage(e, "Reassignment failed."));
    } finally {
      setBusy(false);
    }
  }

  async function doUndo() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const entry = await apiRequest<ReassignHistoryEntry>(
        actionConfig,
        "POST",
        `/customers/${preview.customer.id}/reassign/undo`,
      );
      setNotice(`Undone — customer returned to ${entry.fromUserName ?? "the previous owner"}.`);
      await loadPreview(preview.customer.id);
    } catch (e) {
      setError(errorMessage(e, "Undo failed."));
    } finally {
      setBusy(false);
    }
  }

  const owner = preview?.currentOwner ?? null;
  const targets = (preview?.salesExecutives ?? []).filter((se) => se.id !== owner?.id);

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Configure" }, { label: "Reassign Customers" }]}
        title="Reassign Customers"
        subtitle="Move a customer — and all of their history — from one sales executive to another."
      />

      <div className="max-w-2xl space-y-6">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Customer</label>
          <SearchSelect
            items={customers}
            valueKey={customerId}
            getKey={(c) => c.id}
            getLabel={(c) => c.legalName}
            onSelect={onPickCustomer}
            placeholder="Select a customer…"
            searchPlaceholder="Search customers…"
            emptyText="No customers found"
            contentClassName="w-[440px] p-0"
            renderOption={(c) => (
              <span className="flex flex-col">
                <span className="truncate">{c.legalName}</span>
                {c.customerCode ? (
                  <span className="font-mono text-xs text-muted-foreground">{c.customerCode}</span>
                ) : null}
              </span>
            )}
          />
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={15} className="animate-spin" /> Loading…
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
            {notice}
          </div>
        ) : null}

        {preview && !loading ? (
          <PreviewPanel
            preview={preview}
            owner={owner}
            targets={targets}
            toUserId={toUserId}
            setToUserId={setToUserId}
            confirming={confirming}
            setConfirming={setConfirming}
            busy={busy}
            onReassign={doReassign}
            onUndo={doUndo}
          />
        ) : null}
      </div>
    </>
  );
}

function PreviewPanel({
  preview,
  owner,
  targets,
  toUserId,
  setToUserId,
  confirming,
  setConfirming,
  busy,
  onReassign,
  onUndo,
}: {
  readonly preview: ReassignPreview;
  readonly owner: { id: string; name: string } | null;
  readonly targets: { id: string; name: string }[];
  readonly toUserId: string;
  readonly setToUserId: (v: string) => void;
  readonly confirming: boolean;
  readonly setConfirming: (v: boolean) => void;
  readonly busy: boolean;
  readonly onReassign: () => void;
  readonly onUndo: () => void;
}) {
  const targetName = targets.find((t) => t.id === toUserId)?.name ?? "";
  return (
    <div className="space-y-6 rounded-xl border border-border bg-card px-5 py-4">
      <div>
        <div className="text-base font-semibold text-foreground">{preview.customer.legalName}</div>
        {preview.customer.customerCode ? (
          <div className="font-mono text-xs text-muted-foreground">{preview.customer.customerCode}</div>
        ) : null}
        <div className="mt-1 text-sm text-muted-foreground">
          Current owner:{" "}
          <span className="font-medium text-foreground">{owner ? owner.name : "— none —"}</span>
        </div>
      </div>

      {/* What would move — a compact flat list, not colored cards. */}
      <div>
        <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Records that will move ({totalCount(preview.counts)})
        </div>
        <div className="divide-y divide-border rounded-lg border border-border">
          {COUNT_LABELS.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between px-3 py-1.5 text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-mono tabular-nums text-foreground">{preview.counts[key]}</span>
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Note authorship, the weekly beat, and target/KPI/dues attribution move too. GPS tracking
          and logistics delivery history are left as-is.
        </p>
      </div>

      {/* Reassign to */}
      {owner ? (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Reassign to</label>
          <SearchSelect
            items={targets}
            valueKey={toUserId}
            getKey={(t) => t.id}
            getLabel={(t) => t.name}
            onSelect={(v) => {
              setToUserId(v);
              setConfirming(false);
            }}
            placeholder="Select an executive…"
            searchPlaceholder="Search executives…"
            emptyText="No executives"
            contentClassName="w-[440px] p-0"
          />

          {!confirming ? (
            <button
              type="button"
              disabled={!toUserId || busy}
              onClick={() => setConfirming(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            >
              <ArrowRight size={15} /> Reassign
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2.5">
              <span className="text-sm text-foreground">
                Move <span className="font-medium">{preview.customer.legalName}</span> from{" "}
                <span className="font-medium">{owner.name}</span> to{" "}
                <span className="font-medium">{targetName}</span>?
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={onReassign}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : null} Confirm
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirming(false)}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          This customer has no current owner. Assign a sales executive to it from the customer page
          first.
        </p>
      )}

      {/* History + undo */}
      {preview.history.length > 0 ? (
        <div>
          <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Reassignment history
          </div>
          <div className="space-y-1.5">
            {preview.history.map((h) => (
              <HistoryRow
                key={h.id}
                entry={h}
                undoable={preview.undoable?.id === h.id}
                busy={busy}
                onUndo={onUndo}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HistoryRow({
  entry,
  undoable,
  busy,
  onUndo,
}: {
  readonly entry: ReassignHistoryEntry;
  readonly undoable: boolean;
  readonly busy: boolean;
  readonly onUndo: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
      <span className="text-foreground">{entry.fromUserName ?? "—"}</span>
      <ArrowRight size={13} className="shrink-0 text-muted-foreground" />
      <span className="text-foreground">{entry.toUserName ?? "—"}</span>
      <span className="text-xs text-muted-foreground">
        · {formatDate(entry.createdAt)}
        {entry.assignedByName ? ` · by ${entry.assignedByName}` : ""}
        {` · ${totalCount(entry.counts)} moved`}
      </span>
      <div className="ml-auto">
        {(() => { if (entry.undoneAt) return (
          <span className="text-xs text-muted-foreground">Undone</span>
        ); if (undoable) return (
          <button
            type="button"
            disabled={busy}
            onClick={onUndo}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-accent disabled:opacity-50"
          >
            <RotateCcw size={12} /> Undo
          </button>
        ); return null; })()}
      </div>
    </div>
  );
}
