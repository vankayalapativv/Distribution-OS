import { rupeesExact } from "@/lib/format";
import type { CollectionAllocation } from "./collections-api";

/** Invoice allocations table for the collection detail page. */
export function CollectionAllocations({ allocations }: { readonly allocations: CollectionAllocation[] }) {
  return (
    <div className="rounded-lg border border-border bg-white">
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-sm font-semibold">Invoice Allocations</h3>
      </div>
      {allocations.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          No invoices allocated to this collection yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Invoice Number</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Allocated Amount</th>
              </tr>
            </thead>
            <tbody>
              {allocations.map((alloc, i) => (
                <tr key={alloc.id} className={`transition-colors hover:bg-accent/40 ${i % 2 === 0 ? "bg-background" : "bg-muted/10"}`}>
                  <td className="px-4 py-3 font-mono text-xs font-medium">{alloc.invoiceNumber}</td>
                  <td className="px-4 py-3 text-right font-medium">{rupeesExact(Number(alloc.allocatedAmount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
