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
