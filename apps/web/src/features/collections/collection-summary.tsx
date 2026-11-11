import { formatDateTime, rupeesExact } from "@/lib/format";
import { PAYMENT_MODE_LABELS } from "./collections-columns";
import { CollectionPaymentDetails } from "./collection-payment-details";
import type { CollectionDetail } from "./collections-types";

/** Info cards + review outcome + payment details + remarks for the detail page. */
export function CollectionSummary({ collection }: { readonly collection: CollectionDetail }) {
  const status = collection.accountantApprovalStatus;
  const verified = status === "verified";
  const rejected = status === "rejected";
  const reviewedBy = collection.approvedByAccountantName ?? "—";

  return (
    <>
      {(verified || rejected) && (
        <div className={`rounded-lg border p-4 ${rejected ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}>
          <p className={`text-xs font-medium ${rejected ? "text-red-700" : "text-green-700"}`}>
            {rejected ? "Rejected" : "Verified"}
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {rejected ? "Rejected" : "Verified"} by {reviewedBy} · {formatDateTime(collection.approvedAt)}
          </p>
          {rejected && collection.remarks && (
            <p className="mt-1.5 text-sm text-red-700">Reason: {collection.remarks}</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-white p-4">
          <p className="text-xs text-muted-foreground">Amount</p>
          <p className="mt-1 text-lg font-semibold">{rupeesExact(Number(collection.collectionAmount))}</p>
        </div>
        <div className="rounded-lg border border-border bg-white p-4">
          <p className="text-xs text-muted-foreground">Payment Mode</p>
          <p className="mt-1 text-sm font-semibold">{PAYMENT_MODE_LABELS[collection.paymentMode] ?? collection.paymentMode}</p>
        </div>
        <div className="rounded-lg border border-border bg-white p-4">
          <p className="text-xs text-muted-foreground">Collected By</p>
          <p className="mt-1 text-sm font-semibold">{collection.collectedByName ?? "—"}</p>
        </div>
      </div>

      <CollectionPaymentDetails collection={collection} />

      {/* Remarks — suppressed for a REJECTED collection (its remarks = the reason,
          already shown in the Review card above). */}
      {collection.remarks && !rejected && (
        <div className="rounded-lg border border-border bg-white p-5">
          <h3 className="mb-2 text-sm font-semibold">Remarks</h3>
          <p className="text-sm text-muted-foreground">{collection.remarks}</p>
        </div>
      )}
    </>
  );
}
