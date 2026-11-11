"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MarketNote, MarketNoteItem } from "./market-intelligence-api";
import { DATE_FMT } from "./market-intelligence-media";

export const CATEGORY_LABELS: Record<string, string> = {
  pricing: "Pricing",
  promotion: "Promotion",
  stock: "Stock",
  competitor_activity: "Competitor activity",
  demand: "Demand",
  other: "Other",
};

interface NotesProps {
  readonly notes: MarketNote[];
  readonly onEdit: (note: MarketNote) => void;
  readonly onDelete: (noteId: string) => void;
}

export function MarketIntelligenceNotes({ notes, onEdit, onDelete }: NotesProps) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Meeting notes
      </h3>

      {notes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white px-6 py-10 text-center text-sm text-muted-foreground">
          No notes yet. After a review meeting with an SE, capture their market inputs
          with “New note”.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {notes.map((note) => (
            <div key={note.id} className="rounded-lg border border-border bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-baseline gap-2 text-sm">
                  <span className="font-semibold">{note.seName ?? "Unknown SE"}</span>
                  <span className="text-xs text-muted-foreground">
                    {DATE_FMT.format(new Date(note.meetingDate))}
                  </span>
                  {note.customerName && (
                    <Link
                      href={`/customers/${note.customerId}`}
                      className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-600/20 hover:underline"
                    >
                      {note.customerName}
                    </Link>
                  )}
                  <span className="text-xs text-muted-foreground">
                    noted by {note.createdByName ?? "—"}
                  </span>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(note)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => onDelete(note.id)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>

              {note.note && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{note.note}</p>
              )}

              {note.items.length > 0 && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-slate-50 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Category</th>
                        <th className="px-3 py-2 font-medium">Competitor</th>
                        <th className="px-3 py-2 font-medium">Product</th>
                        <th className="px-3 py-2 font-medium">Price</th>
                        <th className="px-3 py-2 font-medium">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {note.items.map((item: MarketNoteItem) => (
                        <tr key={item.id} className="border-b border-border/50 last:border-0 transition-colors hover:bg-accent/40">
                          <td className="px-3 py-2">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                              {CATEGORY_LABELS[item.category] ?? item.category}
                            </span>
                          </td>
                          <td className="px-3 py-2">{item.competitorBrand ?? "—"}</td>
                          <td className="px-3 py-2">{item.product ?? "—"}</td>
                          <td className="px-3 py-2">
                            {item.price === null ? "—" : `₹${item.price.toLocaleString("en-IN")}`}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{item.details || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
