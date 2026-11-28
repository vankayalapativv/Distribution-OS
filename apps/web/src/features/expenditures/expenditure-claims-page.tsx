"use client";

import { PageHeader } from "@/components/page-header";
import { withQueryClient } from "@/components/data-table/query-provider";
import { DashboardShell } from "@/features/shell/dashboard-shell";
import { useCan } from "@/features/shell/use-can";
import type { ActionConfig } from "@/lib/api-client";
import { ClaimsQueuePanel } from "./claims-queue-panel";

export type ExpenditureClaimsRole = "SUPER_ADMIN" | "MANAGER" | "ACCOUNTANT";

/** The Claims page — field expense claims awaiting approval, reached from the
 *  Expenditure page's "Claims" button. Approving a claim reimburses the employee
 *  in one step (a single dialog on this normal page). */
function ExpenditureClaimsInner({ role, actionConfig }: { readonly role: ExpenditureClaimsRole; readonly actionConfig: ActionConfig }) {
  const canApprove = useCan("action:expenditures.claims.approve");

  return (
    <DashboardShell role={role} active="expenditures">
      <PageHeader title="Claims" subtitle="Field expense claims awaiting approval — approving reimburses the employee." />
      {canApprove ? (
        <div className="rounded-lg border border-border bg-background p-4">
          <ClaimsQueuePanel actionConfig={actionConfig} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">You don&apos;t have access to claims.</p>
      )}
    </DashboardShell>
  );
}

export const ExpenditureClaimsPage = withQueryClient(ExpenditureClaimsInner);
