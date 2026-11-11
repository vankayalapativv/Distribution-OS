"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { DashboardShell } from "@/features/shell/dashboard-shell";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type {
  CustomerLite,
  MarketNote,
  MarketPhoto,
  SalesExecutive,
} from "./market-intelligence-api";
import { MarketIntelligenceGallery } from "./market-intelligence-gallery";
import { MarketIntelligenceNotes } from "./market-intelligence-notes";
import { MarketIntelligenceNoteDialog } from "./market-intelligence-note-dialog";

export type MiRole = "SUPER_ADMIN" | "MANAGER";

interface MiViewProps {
  readonly photos: MarketPhoto[];
  readonly notes: MarketNote[];
  readonly salesExecutives: SalesExecutive[];
  readonly customers: CustomerLite[];
  readonly role: MiRole;
  readonly actionConfig: ActionConfig;
}

export function MarketIntelligenceView({
  photos: initialPhotos,
  notes: initialNotes,
  salesExecutives,
  customers,
  role,
  actionConfig,
}: MiViewProps) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [notes, setNotes] = useState(initialNotes);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<MarketNote | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  function openCreate() {
    setEditingNote(null);
    setDialogOpen(true);
  }

  function openEdit(note: MarketNote) {
    setEditingNote(note);
    setDialogOpen(true);
  }

  function handleSaved(note: MarketNote, wasEdit: boolean) {
    if (wasEdit) {
      setNotes((prev) => prev.map((n) => (n.id === note.id ? note : n)));
    } else {
      setNotes((prev) => [note, ...prev]);
    }
    setDialogOpen(false);
  }

  async function handleDeleteNote(noteId: string) {
    try {
      await apiRequest(actionConfig, "DELETE", `/market-intelligence/notes/${noteId}`);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (e) {
      const message = errorMessage(e, "Could not delete the note.");
      setError(message);
      throw new Error(message);
    }
  }

  return (
    <>
      <DashboardShell role={role} active="market-intelligence">
        <PageHeader
          title="Market Intelligence"
          subtitle="Field photos from the SEs, and the inputs they share in review meetings"
          action={
            <Button onClick={openCreate}>
              <Plus size={15} className="mr-1" /> New note
            </Button>
          }
        />

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <MarketIntelligenceGallery
          photos={photos}
          setPhotos={setPhotos}
          actionConfig={actionConfig}
          onError={setError}
        />

        <MarketIntelligenceNotes
          notes={notes}
          onEdit={openEdit}
          onDelete={setDeletingNoteId}
        />
      </DashboardShell>

      <MarketIntelligenceNoteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        note={editingNote}
        salesExecutives={salesExecutives}
        customers={customers}
        actionConfig={actionConfig}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={deletingNoteId !== null}
        onOpenChange={(open) => !open && setDeletingNoteId(null)}
        title="Delete meeting note?"
        description="This permanently removes the note and everything recorded under it. It can't be undone."
        confirmLabel="Delete note"
        onConfirm={() => handleDeleteNote(deletingNoteId!)}
      />
    </>
  );
}
