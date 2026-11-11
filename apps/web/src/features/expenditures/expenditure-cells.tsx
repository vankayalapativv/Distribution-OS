import { rupeesExact } from "@/lib/format";
import type { Expenditure } from "./expenditures-api";

/** Category name over an optional paid-to line. */
export function CategoryCell({ entry }: { readonly entry: Expenditure }) {
  return (
    <div>
      <p className="font-medium">{entry.categoryName}</p>
      {entry.paidTo ? <p className="text-xs text-muted-foreground">{entry.paidTo}</p> : null}
    </div>
  );
}

/** Amount with a paperclip when a bill is attached. */
export function AmountCell({ entry }: { readonly entry: Expenditure }) {
  return (
    <span className="font-medium">
      {rupeesExact(entry.amount)}
      {entry.hasBill ? (
        <span className="ml-1.5 text-xs text-muted-foreground" title="Bill attached">📎</span>
      ) : null}
    </span>
  );
}
