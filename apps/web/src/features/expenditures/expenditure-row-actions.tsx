import { Pencil, Trash2 } from "lucide-react";
import type { Expenditure } from "./expenditures-api";

/** Trailing Edit / Delete buttons. The row is clickable, so each stops propagation. */
export function ExpenditureRowActions({
  entry,
  onEdit,
  onDelete,
}: {
  readonly entry: Expenditure;
  readonly onEdit: (entry: Expenditure) => void;
  readonly onDelete: (entry: Expenditure) => void;
}) {
  return (
    <div className="flex justify-end gap-1">
      <button
        type="button"
        title="Edit"
        aria-label={`Edit ${entry.expenditureCode}`}
        className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        onClick={(e) => { e.stopPropagation(); onEdit(entry); }}
      >
        <Pencil size={15} />
      </button>
      <button
        type="button"
        title="Delete"
        aria-label={`Delete ${entry.expenditureCode}`}
        className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
        onClick={(e) => { e.stopPropagation(); onDelete(entry); }}
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
