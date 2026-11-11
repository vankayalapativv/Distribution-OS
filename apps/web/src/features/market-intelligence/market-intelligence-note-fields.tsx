"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect } from "@/components/ui/search-select";
import type { CustomerLite, SalesExecutive } from "./market-intelligence-api";

/** The top fields (date, SE, customer, discussion notes) of the note dialog form. */
export function NoteFields({
  meetingDate,
  setMeetingDate,
  seUserId,
  setSeUserId,
  customerId,
  setCustomerId,
  noteText,
  setNoteText,
  salesExecutives,
  customers,
}: {
  readonly meetingDate: string;
  readonly setMeetingDate: (v: string) => void;
  readonly seUserId: string;
  readonly setSeUserId: (v: string) => void;
  readonly customerId: string;
  readonly setCustomerId: (v: string) => void;
  readonly noteText: string;
  readonly setNoteText: (v: string) => void;
  readonly salesExecutives: SalesExecutive[];
  readonly customers: CustomerLite[];
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mi-date">Meeting date</Label>
        <Input
          id="mi-date"
          type="date"
          value={meetingDate}
          onChange={(e) => setMeetingDate(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Sales executive *</Label>
        <SearchSelect
          items={salesExecutives}
          valueKey={seUserId}
          getKey={(se) => se.id}
          getLabel={(se) => se.name}
          onSelect={(v) => { if (v) setSeUserId(v); }}
          placeholder="Who gave this input?"
          searchPlaceholder="Search executive…"
          emptyText="No executives found"
          contentClassName="w-[280px] p-0"
        />
      </div>
      <div className="col-span-2 flex flex-col gap-1.5">
        <Label>Customer (optional)</Label>
        <SearchSelect
          items={[
            { id: "none", name: "None" },
            ...customers.map((c) => ({ id: c.id, name: `${c.legalName} (${c.customerCode})` })),
          ]}
          valueKey={customerId || "none"}
          getKey={(x) => x.id}
          getLabel={(x) => x.name}
          onSelect={(v) => setCustomerId(v && v !== "none" ? v : "")}
          placeholder="None"
          searchPlaceholder="Search customer…"
          emptyText="No customers found"
          contentClassName="w-[360px] p-0"
        />
      </div>
      <div className="col-span-2 flex flex-col gap-1.5">
        <Label htmlFor="mi-note">Discussion notes</Label>
        <textarea
          id="mi-note"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          rows={3}
          placeholder="Summary of what the SE reported from the field…"
          className="rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
      </div>
    </div>
  );
}
