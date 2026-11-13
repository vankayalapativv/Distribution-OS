"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Shimmer } from "@/components/ui/shimmer";
import { apiGet, apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import type { CustomerDetailRole } from "./customer-detail";
import { NoteItem, notesKey, type CustomerNote } from "./customer-note-item";

/**
 * Notes as a chat thread: field notes (SE / Logistics) on the right, office on
 * the left, oldest→newest in a scrollable area, with the composer pinned at the
 * bottom. Auto-scrolls to the newest note on load and after adding one.
 */
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
  const scrollRef = useRef<HTMLDivElement>(null);

  const query = useQuery({
    queryKey: notesKey(customerId),
    queryFn: () => apiGet<{ notes: CustomerNote[] }>(actionConfig, `/customers/${customerId}/notes`),
  });

  // The API returns newest-first; show oldest→newest for the chat thread.
  const notes = useMemo(
    () => [...(query.data?.notes ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [query.data],
  );

  // Stick to the bottom as notes load / arrive.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [notes.length, query.isLoading]);

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
    <div className="flex h-[62vh] min-h-[380px] flex-col gap-3 py-2">
      {/* Thread — scrolls through the whole history */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto rounded-lg border border-border bg-muted/30 p-4">
        {query.isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`flex ${i % 2 ? "justify-end" : "justify-start"}`}>
                <div className="w-[60%] rounded-2xl border border-border bg-white p-4">
                  <Shimmer className="h-3 w-28" />
                  <Shimmer className="mt-2 h-4 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : notes.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No notes yet for this customer.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {notes.map((n) => (
              <NoteItem key={n.id} note={n} isAdmin={isAdmin} customerId={customerId} actionConfig={actionConfig} />
            ))}
          </ul>
        )}
      </div>

      {/* Composer — pinned at the bottom */}
      <div className="rounded-lg border border-border bg-white p-3">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          placeholder="Add a note about this customer…"
        />
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        <div className="mt-2 flex justify-end">
          <Button disabled={!draft.trim() || addMut.isPending} onClick={() => addMut.mutate(draft.trim())}>
            {addMut.isPending ? "Saving…" : "Add note"}
          </Button>
        </div>
      </div>
    </div>
  );
}
