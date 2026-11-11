import { formatDate } from "@/lib/format";
import type { CollectionDetail } from "./collections-types";

/** "Payment Details" card — reference / cheque date / bank / cheque status.
 *  Renders nothing when none of those fields are present. */
export function CollectionPaymentDetails({ collection }: { readonly collection: CollectionDetail }) {
  if (!collection.paymentReferenceNumber && !collection.chequeDate && !collection.bankName) return null;
  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <h3 className="mb-4 text-sm font-semibold">Payment Details</h3>
      <dl className="grid grid-cols-2 gap-4 text-sm lg:grid-cols-3">
        {collection.paymentReferenceNumber && (
          <div>
            <dt className="text-xs text-muted-foreground">Reference Number</dt>
            <dd className="mt-0.5 font-mono text-xs font-medium">{collection.paymentReferenceNumber}</dd>
          </div>
        )}
        {collection.chequeDate && (
          <div>
            <dt className="text-xs text-muted-foreground">Cheque Date</dt>
            <dd className="mt-0.5 font-medium">{formatDate(collection.chequeDate)}</dd>
          </div>
        )}
        {collection.bankName && (
          <div>
            <dt className="text-xs text-muted-foreground">Bank</dt>
            <dd className="mt-0.5 font-medium">{collection.bankName}</dd>
          </div>
        )}
        {collection.chequeStatus && (
          <div>
            <dt className="text-xs text-muted-foreground">Cheque Status</dt>
            <dd className="mt-0.5 font-medium capitalize">{collection.chequeStatus}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
