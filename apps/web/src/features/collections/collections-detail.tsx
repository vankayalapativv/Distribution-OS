"use client";

import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { DashboardShell } from "@/features/shell/dashboard-shell";
import { type ActionConfig } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { CollectionAllocations } from "./collection-allocations";
import { CollectionReceipt } from "./collection-receipt";
import { CollectionRejectDialog } from "./collection-reject-dialog";
import { CollectionSummary } from "./collection-summary";
import { CollectionDetailActions } from "./collection-detail-actions";
import { useCollectionDetail } from "./use-collection-detail";
import type { CollectionDetail } from "./collections-types";

export type CollectionDetailRole = "SUPER_ADMIN" | "MANAGER" | "ACCOUNTANT";

export function CollectionDetailView({
  collection: initialCollection, role, actionConfig,
}: {
  readonly collection: CollectionDetail;
  readonly role: CollectionDetailRole;
  readonly actionConfig: ActionConfig;
}) {
  const canReview = role === "SUPER_ADMIN" || role === "ACCOUNTANT";
  const c = useCollectionDetail(initialCollection, actionConfig);
  const { collection } = c;

  return (
    <>
      <DashboardShell role={role} active="collections">
        <PageHeader
          crumbs={[
            // Collections lives under "Management" (SA/Manager) or "Finance" (Accountant).
            { label: role === "ACCOUNTANT" ? "Finance" : "Management" },
            { label: "Collections", href: "/collections" },
            { label: collection.collectionCode },
          ]}
          title={collection.collectionCode}
          subtitle={
            <>
              {collection.customerId ? (
                <Link href={`/customers/${collection.customerId}`} className="font-medium text-primary hover:underline">
                  {collection.customerName ?? "Unknown customer"}
                </Link>
              ) : (
                collection.customerName ?? "Unknown customer"
              )}
              {` · ${formatDate(collection.collectionDate)}`}
            </>
          }
          action={
            <CollectionDetailActions
              status={collection.accountantApprovalStatus}
              canReview={canReview}
              isPending={c.isPending}
              isVerifying={c.isVerifying}
              onVerify={c.handleVerify}
              onReject={() => c.setRejectOpen(true)}
            />
          }
        />

        {c.verifyError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{c.verifyError}</p>}

        <CollectionSummary collection={collection} />

        {canReview && collection.proof && (
          <CollectionReceipt collectionId={collection.id} proof={collection.proof} actionConfig={actionConfig} />
        )}

        <CollectionAllocations allocations={collection.allocations} />
      </DashboardShell>

      <CollectionRejectDialog
        open={c.rejectOpen}
        onOpenChange={c.setRejectOpen}
        collection={collection}
        actionConfig={actionConfig}
        onRejected={c.setCollection}
      />
    </>
  );
}
