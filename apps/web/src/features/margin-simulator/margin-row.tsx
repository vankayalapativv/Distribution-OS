"use client";

import { type ChangeEvent, type KeyboardEvent, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { errorMessage, type ActionConfig } from "@/lib/api-client";
import { computeMargin } from "./margin-calc";
import { updateSim } from "./margin-client";
import { inrLitre, inrPack, marginTone, numericInput } from "./margin-format";
import type { MarginSim } from "./margin-api";

interface Draft {
  mrp: string;
  dlp: string;
  expensePerLiter: string;
  schemePerLiter: string;
  coupon: string;
  mop: string;
}

const FIELDS = ["mrp", "dlp", "expensePerLiter", "schemePerLiter", "coupon", "mop"] as const;
const toDraft = (r: MarginSim): Draft => ({
  mrp: r.mrp == null ? "" : String(r.mrp),
  dlp: String(r.dlp),
  expensePerLiter: String(r.expensePerLiter),
  schemePerLiter: String(r.schemePerLiter),
  coupon: r.coupon == null ? "" : String(r.coupon),
  mop: String(r.mop),
});
const n = (s: string) => (s === "" ? 0 : Number(s));
const same = (a: Draft, b: Draft) => FIELDS.every((k) => a[k] === b[k]);

/**
 * Spreadsheet-style Left/Right cell nav — only jump when the caret is at the edge
 * of the value (so you can still move the cursor inside a number), stopping at the
 * first/last cell of the row. Operates purely on the DOM event; no component state.
 */
function navigateCell(e: KeyboardEvent<HTMLInputElement>) {
  const el = e.currentTarget;
  const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
  const atEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length;
  const goNext = e.key === "ArrowRight" && atEnd;
  const goPrev = e.key === "ArrowLeft" && atStart;
  if (!goNext && !goPrev) return; // let the caret move within the input

  const inputs = Array.from(el.closest("tr")?.querySelectorAll("input") ?? []);
  const target = inputs[inputs.indexOf(el) + (goNext ? 1 : -1)];
  if (!target) return; // at the row's first/last cell → stop
  e.preventDefault();
  target.focus();
  const pos = goNext ? 0 : target.value.length; // caret lands at the near edge
  target.setSelectionRange(pos, pos);
}

/**
 * A spreadsheet-style row. View mode shows plain gridline cells; the per-row ⋯
 * menu (Edit / Save / Revert / Delete) toggles edit mode, where each cell is an
 * in-place editor (Tab between cells, Enter saves, Esc reverts) and margins
 * recompute live. Product & pack are fixed; nothing persists until Save.
 */
export function MarginRow({
  row,
  actionConfig,
  onDelete,
}: {
  readonly row: MarginSim;
  readonly actionConfig: ActionConfig;
  readonly onDelete: (r: MarginSim) => void;
}) {
  const [base, setBase] = useState<Draft>(() => toDraft(row));
  const [draft, setDraft] = useState<Draft>(() => toDraft(row));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dirty = !same(draft, base);

  const src = editing ? draft : base;
  const m = computeMargin({
    packSize: row.packSize,
    dlp: n(src.dlp),
    expensePerLiter: n(src.expensePerLiter),
    mop: n(src.mop),
    schemePerLiter: n(src.schemePerLiter),
  });
  const tone = marginTone(m.marginPerLiter);

  const set = (k: keyof Draft) => (e: ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => ({ ...d, [k]: numericInput(e.target.value) }));

  function toggleMenu() {
    if (menu) return setMenu(null);
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setMenu({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await updateSim(actionConfig, row.id, {
        productId: row.productId,
        productName: row.productName,
        packSize: row.packSize,
        mrp: draft.mrp === "" ? null : n(draft.mrp),
        dlp: n(draft.dlp),
        expensePerLiter: n(draft.expensePerLiter),
        schemePerLiter: n(draft.schemePerLiter),
        coupon: draft.coupon === "" ? null : n(draft.coupon),
        mop: n(draft.mop),
      });
      setBase(draft);
      setEditing(false);
      setMenu(null);
    } catch (err) {
      setError(errorMessage(err, "Save failed."));
    } finally {
      setSaving(false);
    }
  }

  function revert() {
    setDraft(base);
    setEditing(false);
    setError(null);
    setMenu(null);
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (dirty) void save();
      return;
    }
    if (e.key === "Escape") {
      revert();
      return;
    }
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") navigateCell(e);
  };

  const cell = (k: keyof Draft) => (
    <TableCell className="border-l border-border p-0 text-center">
      {editing ? (
        <input
          value={draft[k]}
          onChange={set(k)}
          onKeyDown={onKey}
          inputMode="decimal"
          className="h-9 w-[4.75rem] bg-transparent px-2 text-center text-sm tabular-nums outline-none focus:bg-amber-100/70"
        />
      ) : (
        <div className="px-2.5 py-2 text-sm tabular-nums text-foreground">{draft[k] === "" ? "—" : draft[k]}</div>
      )}
    </TableCell>
  );

  const item = (label: string, onClick: () => void, opts?: { tone?: string; disabled?: boolean }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={opts?.disabled}
      className={`flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-50 ${opts?.tone ?? ""}`}
    >
      {label}
    </button>
  );

  return (
    <TableRow className={editing ? "bg-amber-50" : undefined}>
      <TableCell className="py-2">
        <div className="font-medium">{row.productName}</div>
        <div className="text-xs text-muted-foreground">{row.packSize} L</div>
      </TableCell>
      {cell("mrp")}
      {cell("dlp")}
      {cell("expensePerLiter")}
      {cell("schemePerLiter")}
      {cell("coupon")}
      {cell("mop")}
      <TableCell className={`border-l border-border px-2.5 text-center font-semibold tabular-nums ${tone}`}>
        {inrPack(m.marginPerPack)}
      </TableCell>
      <TableCell className={`border-l border-border px-2.5 text-center font-semibold tabular-nums ${tone}`}>
        {inrLitre(m.marginPerLiter)}
      </TableCell>
      <TableCell className="border-l border-border text-center">
        <button
          ref={btnRef}
          type="button"
          onClick={toggleMenu}
          aria-label="Row actions"
          className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <MoreHorizontal size={16} />
        </button>
        {error && <div className="px-1 pb-1 text-center text-xs text-destructive">{error}</div>}
        {menu &&
          createPortal(
            <div className="fixed inset-0 z-50" onMouseDown={() => setMenu(null)}>
              <div
                style={{ position: "fixed", top: menu.top, right: menu.right }}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-36 rounded-md border border-border bg-white p-1 shadow-lg"
              >
                {!editing && item("Edit", () => { setEditing(true); setMenu(null); })}
                {editing && item(saving ? "Saving…" : "Save", save, { tone: "text-primary", disabled: !dirty || saving })}
                {editing && item("Revert", revert)}
                {item("Delete", () => { setMenu(null); onDelete(row); }, { tone: "text-destructive" })}
              </div>
            </div>,
            document.body,
          )}
      </TableCell>
    </TableRow>
  );
}
