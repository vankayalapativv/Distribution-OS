"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** The inline edit form shown in place of a note bubble while editing. */
export function NoteEditor({
  field, text, setText, err, saving, onSave, onCancel,
}: {
  readonly field: boolean;
  readonly text: string;
  readonly setText: (v: string) => void;
  readonly err: string | null;
  readonly saving: boolean;
  readonly onSave: () => void;
  readonly onCancel: () => void;
}) {
  return (
    <li className={`flex flex-col ${field ? "items-end" : "items-start"}`}>
      <div className="w-full max-w-[82%] rounded-2xl border border-border bg-white p-3 shadow-sm">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} autoFocus />
        {err ? <p className="mt-2 text-sm text-destructive">{err}</p> : null}
        <div className="mt-2 flex gap-2">
          <Button size="sm" disabled={!text.trim() || saving} onClick={onSave}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </li>
  );
}

/** Super-Admin Edit / Delete row under a note bubble (reveals on hover/focus). */
export function NoteActions({
  onEdit, onDelete, deleting, err,
}: {
  readonly onEdit: () => void;
  readonly onDelete: () => void;
  readonly deleting: boolean;
  readonly err: string | null;
}) {
  return (
    <div className="flex items-center gap-3 px-1 text-xs font-medium opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
      <button type="button" onClick={onEdit} className="text-primary hover:underline">Edit</button>
      <button type="button" disabled={deleting} onClick={onDelete}
        className="text-destructive hover:underline disabled:opacity-40">Delete</button>
      {err ? <span className="text-destructive">{err}</span> : null}
    </div>
  );
}
