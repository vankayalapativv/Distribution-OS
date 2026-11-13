"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";

export interface CustomerNote {
  id: string;
  body: string;
  createdAt: string;
  authorName: string;
  /** Author's role code; field roles sit on the right of the thread. */
  authorRole: string | null;
  edited: boolean;
  editedAt: string | null;
  editorName: string | null;
}

export const notesKey = (customerId: string) => ["customer-notes", customerId];

/** Field-written notes (Sales Executive / Logistics) align right; office left. */
export function isFieldNote(note: CustomerNote): boolean {
  return note.authorRole === "SALES_EXECUTIVE" || note.authorRole === "LOGISTICS";
}

/** One note, as a chat bubble. Super-Admins get inline edit / delete. */
export function NoteItem({
  note, isAdmin, customerId, actionConfig,
}: {
  readonly note: CustomerNote;
  readonly isAdmin: boolean;
  readonly customerId: string;
  readonly actionConfig: ActionConfig;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.body);
  const [err, setErr] = useState<string | null>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: notesKey(customerId) });
  const field = isFieldNote(note);

  const saveMut = useMutation({
    mutationFn: (body: string) =>
      apiRequest(actionConfig, "PATCH", `/customers/${customerId}/notes/${note.id}`, { body }),
    onSuccess: () => { setEditing(false); setErr(null); invalidate(); },
    onError: (e) => setErr(errorMessage(e, "Couldn't update the note.")),
  });
  const delMut = useMutation({
    mutationFn: () => apiRequest(actionConfig, "DELETE", `/customers/${customerId}/notes/${note.id}`),
    onSuccess: () => { setErr(null); invalidate(); },
    onError: (e) => setErr(errorMessage(e, "Couldn't delete the note.")),
  });

  if (editing) {
    return (
      <li className={`flex flex-col ${field ? "items-end" : "items-start"}`}>
        <div className="w-full max-w-[82%] rounded-2xl border border-border bg-white p-3 shadow-sm">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} autoFocus />
          {err ? <p className="mt-2 text-sm text-destructive">{err}</p> : null}
          <div className="mt-2 flex gap-2">
            <Button size="sm" disabled={!text.trim() || saveMut.isPending}
              onClick={() => saveMut.mutate(text.trim())}>
              {saveMut.isPending ? "Saving…" : "Save"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setEditing(false); setErr(null); }}>Cancel</Button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className={`group flex flex-col gap-1 ${field ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
          field
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md border border-border bg-white text-foreground"
        }`}
      >
        <div
          className={`mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] ${
            field ? "text-primary-foreground/80" : "text-muted-foreground"
          }`}
        >
          <span className="font-semibold">{note.authorName}</span>
          <span>{formatDateTime(note.createdAt)}</span>
          {note.edited ? <span>· edited</span> : null}
        </div>
        <p className="whitespace-pre-wrap break-words">{note.body}</p>
      </div>

      {note.edited && note.editorName ? (
        <p className="px-1 text-[11px] text-muted-foreground">
          edited by {note.editorName} · {formatDateTime(note.editedAt)}
        </p>
      ) : null}

      {isAdmin ? (
        <div className="flex items-center gap-3 px-1 text-xs font-medium opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <button type="button" onClick={() => { setText(note.body); setErr(null); setEditing(true); }}
            className="text-primary hover:underline">Edit</button>
          <button type="button" disabled={delMut.isPending}
            onClick={() => { if (window.confirm("Delete this note permanently?")) delMut.mutate(); }}
            className="text-destructive hover:underline disabled:opacity-40">Delete</button>
          {err ? <span className="text-destructive">{err}</span> : null}
        </div>
      ) : null}
    </li>
  );
}
