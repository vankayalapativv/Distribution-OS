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
  edited: boolean;
  editedAt: string | null;
  editorName: string | null;
}

export const notesKey = (customerId: string) => ["customer-notes", customerId];

/** One saved note, with Super-Admin-only edit / delete controls. */
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

  return (
    <li className="rounded-lg border border-border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-foreground">{note.authorName}</span>
          <span className="text-muted-foreground">{formatDateTime(note.createdAt)}</span>
          {note.edited ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              edited
            </span>
          ) : null}
        </div>
        {isAdmin && !editing ? (
          <div className="flex shrink-0 gap-3 text-xs font-medium">
            <button type="button" onClick={() => { setText(note.body); setEditing(true); }}
              className="text-primary hover:underline">Edit</button>
            <button type="button" disabled={delMut.isPending}
              onClick={() => { if (window.confirm("Delete this note permanently?")) delMut.mutate(); }}
              className="text-destructive hover:underline disabled:opacity-40">Delete</button>
          </div>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-3">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} />
          {err ? <p className="mt-2 text-sm text-destructive">{err}</p> : null}
          <div className="mt-2 flex gap-2">
            <Button size="sm" disabled={!text.trim() || saveMut.isPending}
              onClick={() => saveMut.mutate(text.trim())}>
              {saveMut.isPending ? "Saving…" : "Save"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{note.body}</p>
      )}

      {note.edited && note.editorName ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          edited by {note.editorName} · {formatDateTime(note.editedAt)}
        </p>
      ) : null}
    </li>
  );
}
