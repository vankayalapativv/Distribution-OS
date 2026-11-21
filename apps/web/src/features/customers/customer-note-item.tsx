"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { NoteActions, NoteEditor } from "./customer-note-parts";
import { isFieldNote, notesKey, type CustomerNote } from "./customer-note-types";

export { notesKey, isFieldNote, type CustomerNote } from "./customer-note-types";

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
      <NoteEditor
        field={field}
        text={text}
        setText={setText}
        err={err}
        saving={saveMut.isPending}
        onSave={() => saveMut.mutate(text.trim())}
        onCancel={() => { setEditing(false); setErr(null); }}
      />
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
        <NoteActions
          onEdit={() => { setText(note.body); setErr(null); setEditing(true); }}
          onDelete={() => { if (window.confirm("Delete this note permanently?")) delMut.mutate(); }}
          deleting={delMut.isPending}
          err={err}
        />
      ) : null}
    </li>
  );
}
