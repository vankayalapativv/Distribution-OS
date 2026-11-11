"use client";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { STATUS_CLASSES } from "./collections-columns";

/** Header actions on the detail page: status pill + Verify / Reject (reviewers,
 *  pending collections only). */
export function CollectionDetailActions({
  status, canReview, isPending, isVerifying, onVerify, onReject,
}: {
  readonly status: string;
  readonly canReview: boolean;
  readonly isPending: boolean;
  readonly isVerifying: boolean;
  readonly onVerify: () => void;
  readonly onReject: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <StatusBadge status={status} tones={STATUS_CLASSES} />
      {canReview && isPending && (
        <>
          <Button size="sm" onClick={onVerify} disabled={isVerifying} className="bg-green-600 text-white hover:bg-green-700">
            {isVerifying ? "Verifying…" : "Verify"}
          </Button>
          <Button size="sm" variant="outline" onClick={onReject} className="border-red-200 text-red-600 hover:bg-red-50">
            Reject
          </Button>
        </>
      )}
    </div>
  );
}
