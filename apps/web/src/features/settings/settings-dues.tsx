"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { withQueryClient } from "@/components/data-table/query-provider";
import { apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PanelHeader } from "./settings-shared";
import { SectionCard } from "./settings-card";

interface Band {
  ordinal: number;
  fromDays: number;
  toDays: number | null;
  label: string;
}
type Row = { fromDays: string; toDays: string; label: string };

function toRows(bands: Band[]): Row[] {
  return bands.map((b) => ({
    fromDays: String(b.fromDays),
    toDays: b.toDays === null ? "" : String(b.toDays),
    label: b.label,
  }));
}

/** Mirror of the server's validateDuesBands: exactly 4 contiguous bands, 0 → ∞. */
function validate(rows: Row[]): string | null {
  if (rows.length !== 4) return "There must be exactly 4 bands.";
  for (let i = 0; i < 4; i++) {
    if (!rows[i].label.trim()) return `Band ${i + 1} needs a label.`;
    if (rows[i].fromDays.trim() === "" || Number.isNaN(Number(rows[i].fromDays))) return `Band ${i + 1} needs a start day.`;
  }
  if (Number(rows[0].fromDays) !== 0) return "The first band must start at day 0.";
  if (rows[3].toDays.trim() !== "") return "The last band must be open-ended — leave its To blank.";
  for (let i = 0; i < 3; i++) {
    const to = Number(rows[i].toDays);
    if (rows[i].toDays.trim() === "" || Number.isNaN(to)) return `Band ${i + 1} needs an end day.`;
    if (Number(rows[i + 1].fromDays) !== to + 1)
      return `Band ${i + 2} must start the day after band ${i + 1} ends (no gaps or overlaps).`;
  }
  return null;
}

function DuesPanelInner({ actionConfig }: Readonly<{ actionConfig: ActionConfig }>) {
  const q = useQuery({
    queryKey: ["settings-dues-bands"],
    queryFn: () => apiRequest<{ bands: Band[] }>(actionConfig, "GET", "/dues/bands"),
  });
  // `edits` is a local overlay over the fetched bands: null means "unchanged,
  // show the server's values". This avoids a setState-in-effect sync.
  const [edits, setEdits] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const rows = edits ?? (q.data?.bands ? toRows(q.data.bands) : null);

  const setCell = (i: number, patch: Partial<Row>) => {
    setSaved(false);
    setError(null);
    setEdits((prev) => {
      const base = prev ?? rows;
      if (!base) return prev;
      return base.map((r, j) => (j === i ? { ...r, ...patch } : r));
    });
  };

  async function save() {
    if (!rows) return;
    const err = validate(rows);
    if (err) {
      setError(err);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const bands = rows.map((r) => ({
        fromDays: Number(r.fromDays),
        toDays: r.toDays.trim() === "" ? null : Number(r.toDays),
        label: r.label.trim(),
      }));
      await apiRequest(actionConfig, "PUT", "/dues/bands", { bands });
      setSaved(true);
      setEdits(null); // fall back to the refetched server values
      await q.refetch();
    } catch (e) {
      setError(errorMessage(e, "Could not save the dues bands."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PanelHeader
        title="Collection Dues"
        subtitle="The 4 ageing bands used by the dashboard, dues reports and the field app."
      />
      <SectionCard
        icon={<CalendarClock size={18} />}
        title="Dues bands"
        description="Exactly 4 contiguous bands starting at day 0; the last is open-ended (leave its To blank). Editing re-ages all current dues immediately."
      >
        {!rows ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="hidden grid-cols-[90px_90px_1fr] gap-2.5 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
              <span>From</span>
              <span>To</span>
              <span>Label</span>
            </div>
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr] gap-2.5 sm:grid-cols-[90px_90px_1fr]">
                <Input
                  className="font-mono"
                  value={r.fromDays}
                  onChange={(e) => setCell(i, { fromDays: e.target.value })}
                  aria-label={`Band ${i + 1} from day`}
                />
                <Input
                  className="font-mono"
                  value={r.toDays}
                  placeholder={i === 3 ? "∞" : ""}
                  onChange={(e) => setCell(i, { toDays: e.target.value })}
                  aria-label={`Band ${i + 1} to day`}
                />
                <Input value={r.label} onChange={(e) => setCell(i, { label: e.target.value })} aria-label={`Band ${i + 1} label`} />
              </div>
            ))}
            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
            <div className="flex items-center gap-3 pt-1">
              <Button onClick={save} disabled={busy}>
                {busy ? "Saving…" : "Save bands"}
              </Button>
              {saved ? <span className="text-sm font-medium text-emerald-600">Saved</span> : null}
            </div>
          </div>
        )}
      </SectionCard>
    </>
  );
}

export const DuesPanel = withQueryClient(DuesPanelInner);
