import type { OrderItem, SkuProgress } from "./orders-api";
import { OrderDetailItemName } from "./order-detail-item-name";
import { itemOriginal } from "./order-detail-item-helpers";

interface OrderDetailItemRowProps {
  item: OrderItem;
  progress?: SkuProgress;
  even: boolean;
  showProgress: boolean;
  showCancelled: boolean;
  showReturned: boolean;
}

const CELL = "px-4 py-3 text-right";

/** One line-items table row. Extra Invoiced/Remaining/Cancelled/Returned cells are
 *  rendered only when the parent table shows those columns. */
export function OrderDetailItemRow({
  item,
  progress,
  even,
  showProgress,
  showCancelled,
  showReturned,
}: Readonly<OrderDetailItemRowProps>) {
  const cancelledUnits = progress?.cancelledUnits ?? 0;
  const { originalQty, originalLitres } = itemOriginal(item, cancelledUnits);
  const done = progress ? progress.remainingUnits <= 0 : false;

  return (
    <tr className={`transition-colors hover:bg-accent/40 ${even ? "bg-background" : "bg-muted/10"}`}>
      <td className="px-4 py-3 font-medium">
        <OrderDetailItemName item={item} />
      </td>
      <td className="px-4 py-3 text-muted-foreground">{item.brand ?? "—"}</td>
      <td className="px-4 py-3 text-muted-foreground">{item.segment ?? "—"}</td>
      <td className={`${CELL} text-muted-foreground`}>{item.packSizeLitres != null ? `${item.packSizeLitres} L` : "—"}</td>
      <td className={`${CELL} text-muted-foreground`}>{originalQty}</td>
      <td className={`${CELL} font-medium`}>{originalLitres != null ? `${originalLitres} L` : "—"}</td>

      {showProgress &&
        (progress ? (
          <>
            <td className={`${CELL} tabular-nums text-muted-foreground`}>{progress.invoicedUnits}</td>
            <td className={`${CELL} tabular-nums`}>
              {done ? (
                <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700 ring-1 ring-green-600/20">
                  Done
                </span>
              ) : (
                <span className="font-medium text-amber-700">{progress.remainingUnits}</span>
              )}
            </td>
          </>
        ) : (
          <>
            <td className={`${CELL} text-muted-foreground`}>—</td>
            <td className={`${CELL} text-muted-foreground`}>—</td>
          </>
        ))}

      {showCancelled && (
        <td className={`${CELL} tabular-nums`}>
          {cancelledUnits > 0 ? (
            <span className="font-medium text-purple-700">{cancelledUnits}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
      )}

      {showReturned && (
        <td className={`${CELL} tabular-nums`}>
          {(progress?.returnedUnits ?? 0) > 0 ? (
            <span className="font-medium text-rose-600">{progress?.returnedUnits}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
      )}
    </tr>
  );
}
