import type { OrderItem, SkuProgress } from "./orders-api";
import { OrderDetailItemRow } from "./order-detail-item-row";

const TH = "px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground";

/** Line-items table for an order detail view. When `progress` is supplied, the
 *  table gains per-SKU Invoiced / Remaining columns (partial delivery). */
export function OrderDetailItems({ items, progress }: { readonly items: OrderItem[]; readonly progress?: SkuProgress[] }) {
  const progressById = new Map((progress ?? []).map((p) => [p.orderItemId, p]));
  const showProgress = (progress?.length ?? 0) > 0;
  // Only surface the Returned / Cancelled columns when something was actually
  // returned / short-closed (a short-close shrinks live qty to the invoiced amount).
  const showReturned = (progress ?? []).some((p) => (p.returnedUnits ?? 0) > 0);
  const showCancelled = (progress ?? []).some((p) => (p.cancelledUnits ?? 0) > 0);

  return (
    <div className="rounded-lg border border-border bg-white">
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-sm font-semibold">Line Items</h3>
      </div>
      {items.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">No line items.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className={`${TH} text-left`}>Item</th>
                <th className={`${TH} text-left`}>Brand</th>
                <th className={`${TH} text-left`}>Segment / Type</th>
                <th className={`${TH} text-right`}>Pack (L)</th>
                <th className={`${TH} text-right`}>Qty</th>
                <th className={`${TH} text-right`}>Total (L)</th>
                {showProgress && (
                  <>
                    <th className={`${TH} text-right`}>Invoiced</th>
                    <th className={`${TH} text-right`}>Remaining</th>
                  </>
                )}
                {showCancelled && <th className={`${TH} text-right`}>Cancelled</th>}
                {showReturned && <th className={`${TH} text-right`}>Returned</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <OrderDetailItemRow
                  key={item.id}
                  item={item}
                  progress={progressById.get(item.id)}
                  even={i % 2 === 0}
                  showProgress={showProgress}
                  showCancelled={showCancelled}
                  showReturned={showReturned}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
