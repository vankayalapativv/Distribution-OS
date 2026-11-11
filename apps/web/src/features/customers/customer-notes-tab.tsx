"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Shimmer } from "@/components/ui/shimmer";
import { apiGet, apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import type { CustomerDetailRole } from "./customer-detail";
import { NoteItem, notesKey, type CustomerNote } from "./customer-note-item";

export function CustomerNotesTab({
  customerId, role, actionConfig,
}: {
  readonly customerId: string;
  readonly role: CustomerDetailRole;
  readonly actionConfig: ActionConfig;
}) {
  const qc = useQueryClient();
  const isAdmin = role === "SUPER_ADMIN";
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: notesKey(customerId),
    queryFn: () => apiGet<{ notes: CustomerNote[] }>(actionConfig, `/customers/${customerId}/notes`),
  });
  const notes = query.data?.notes ?? [];

  const addMut = useMutation({
    mutationFn: (body: string) =>
      apiRequest(actionConfig, "POST", `/customers/${customerId}/notes`, { body }),
    onSuccess: () => {
      setDraft(""); setError(null);
      qc.invalidateQueries({ queryKey: notesKey(customerId) });
    },
    onError: (e) => setError(errorMessage(e, "Couldn't save the note.")),
  });

  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="rounded-lg border border-border bg-white p-4">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="Add a note about this customer…"
        />
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        <div className="mt-3 flex items-center justify-end gap-3">
          <Button disabled={!draft.trim() || addMut.isPending}
            onClick={() => addMut.mutate(draft.trim())}>
            {addMut.isPending ? "Saving…" : "Add note"}
          </Button>
        </div>
      </div>

      {(() => { if (query.isLoading) return (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-white p-4">
              <Shimmer className="h-4 w-40" />
              <Shimmer className="mt-2 h-4 w-full" />
              <Shimmer className="mt-1.5 h-4 w-2/3" />
            </div>
          ))}
        </div>
      ); if (notes.length === 0) return (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No notes yet for this customer.
        </p>
      ); return (
        <ul className="flex flex-col gap-3">
          {notes.map((n) => (
            <NoteItem key={n.id} note={n} isAdmin={isAdmin}
              customerId={customerId} actionConfig={actionConfig} />
          ))}
        </ul>
      ); })()}
    </div>
  );
}
