import { Pencil, Trash2 } from "lucide-react";

/** Row handlers for the oil catalogue table. Stock lives on the
 *  dedicated Stock Journal page now, so these are just edit/delete. */
export interface CatalogueHandlers<T> {
  onEdit: (row: T) => void;
  onDelete: (row: T) => void;
  /** false for ACCOUNTANT — catalogue edit/delete hidden. */
  canManage: boolean;
}

/** Edit + delete action buttons shared by the catalogue tables. */
export function RowActions<T>({
  row, onEdit, onDelete, label,
}: Readonly<{
  row: T;
  onEdit: (row: T) => void;
  onDelete: (row: T) => void;
  label: string;
}>) {
  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); onEdit(row); }}
        className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label={`Edit ${label}`}
      >
        <Pencil size={14} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(row); }}
        className="ml-1 rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        aria-label={`Delete ${label}`}
      >
        <Trash2 size={14} />
      </button>
    </>
  );
}
