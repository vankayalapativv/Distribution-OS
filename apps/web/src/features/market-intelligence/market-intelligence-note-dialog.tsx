"use client";

import { useState, type SyntheticEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import type {
  CustomerLite,
  MarketNote,
  SalesExecutive,
} from "./market-intelligence-api";
import { IntelligenceItems, type ItemDraft } from "./market-intelligence-item-rows";
import { NoteFields } from "./market-intelligence-note-fields";
import { saveLabel } from "@/lib/format";

interface NoteDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly note: MarketNote | null;
  readonly salesExecutives: SalesExecutive[];
  readonly customers: CustomerLite[];
  readonly actionConfig: ActionConfig;
  readonly onSaved: (note: MarketNote, wasEdit: boolean) => void;
}

export function MarketIntelligenceNoteDialog({
  open,
  onOpenChange,
  note,
  salesExecutives,
  customers,
  actionConfig,
  onSaved,
}: NoteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        {open && (
          <NoteForm
            key={note?.id ?? "new"}
            note={note}
            salesExecutives={salesExecutives}
            customers={customers}
            actionConfig={actionConfig}
            onCancel={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function NoteForm({
  note,
  salesExecutives,
  customers,
  actionConfig,
  onCancel,
  onSaved,
}: {
  readonly note: MarketNote | null;
  readonly salesExecutives: SalesExecutive[];
  readonly customers: CustomerLite[];
  readonly actionConfig: ActionConfig;
  readonly onCancel: () => void;
  readonly onSaved: (note: MarketNote, wasEdit: boolean) => void;
}) {
  const editingId = note?.id ?? null;
  const [meetingDate, setMeetingDate] = useState(
    // IST today (not UTC, which pre-fills yesterday between IST midnight and 05:30).
    note ? note.meetingDate : new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }),
  );
  const [seUserId, setSeUserId] = useState(note?.seUserId ?? "");
  const [customerId, setCustomerId] = useState(note?.customerId ?? "");
  const [noteText, setNoteText] = useState(note?.note ?? "");
  const [items, setItems] = useState<ItemDraft[]>(
    note
      ? note.items.map((i) => ({
          uid: crypto.randomUUID(),
          category: i.category,
          competitorBrand: i.competitorBrand ?? "",
          product: i.product ?? "",
          price: i.price === null ? "" : String(i.price),
          details: i.details,
        }))
      : [],
  );
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  async function handleSave(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!seUserId) {
      setDialogError("Select the sales executive who gave this input.");
      return;
    }
    setSaving(true);
    setDialogError(null);

    const body = {
      meetingDate: meetingDate || null,
      seUserId,
      customerId: customerId || null,
      note: noteText.trim(),
      items: items
        // Keep a row that carries a price even if its text fields are blank
        // (previously a category+price-only row was silently dropped).
        .filter((i) => i.details.trim() || i.competitorBrand.trim() || i.product.trim() || i.price.trim())
        .map((i) => ({
          category: i.category,
          competitorBrand: i.competitorBrand.trim() || null,
          product: i.product.trim() || null,
          // A non-numeric price → null (don't silently serialize NaN).
          price: i.price.trim() && Number.isFinite(Number(i.price)) ? Number(i.price) : null,
          details: i.details.trim(),
        })),
    };

    try {
      if (editingId) {
        const data = await apiRequest<{ note: MarketNote }>(
          actionConfig,
          "PATCH",
          `/market-intelligence/notes/${editingId}`,
          body,
        );
        onSaved(data.note, true);
      } else {
        const data = await apiRequest<{ note: MarketNote }>(
          actionConfig,
          "POST",
          "/market-intelligence/notes",
          body,
        );
        onSaved(data.note, false);
      }
    } catch (e) {
      setDialogError(errorMessage(e, "Could not save the note."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
      <DialogHeader>
        <DialogTitle>{note ? "Edit meeting note" : "New meeting note"}</DialogTitle>
      </DialogHeader>
      <DialogBody className="space-y-4">
        <NoteFields
          meetingDate={meetingDate}
          setMeetingDate={setMeetingDate}
          seUserId={seUserId}
          setSeUserId={setSeUserId}
          customerId={customerId}
          setCustomerId={setCustomerId}
          noteText={noteText}
          setNoteText={setNoteText}
          salesExecutives={salesExecutives}
          customers={customers}
        />

        <IntelligenceItems items={items} setItems={setItems} />

        {dialogError && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {dialogError}
          </p>
        )}
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saveLabel(saving, editingId, "Create note")}
        </Button>
      </DialogFooter>
    </form>
  );
}
