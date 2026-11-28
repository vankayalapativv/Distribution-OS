"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { withQueryClient } from "@/components/data-table/query-provider";
import { DashboardShell } from "@/features/shell/dashboard-shell";
import { useCan } from "@/features/shell/use-can";
import { cn } from "@/lib/utils";
import type { ActionConfig } from "@/lib/api-client";
import { ClaimsQueuePanel } from "./claims-queue-panel";
import { AdvancesPanel } from "./advances-panel";
import { SalaryPanel } from "./salary-panel";
import { EmployeeLedgerDialogBody } from "./employee-ledger-dialog";
import { useClaimsQueue } from "./use-claims-queue";

export type ExpenditureDeskRole = "SUPER_ADMIN" | "MANAGER" | "ACCOUNTANT";
type TabKey = "claims" | "advances" | "salary" | "ledger";

const LABELS: Record<TabKey, string> = {
  claims: "Claims",
  advances: "Advances",
  salary: "Salary & pay",
  ledger: "Employee ledger",
};

/** The Expense desk: one page with tabs for Claims / Advances / Salary & pay /
 *  Employee ledger — reached from the Expenditure page's ⋮ menu (deep-linked via
 *  ?tab=). Replaces the old stacked dialogs so actions open a single dialog on a
 *  normal page, never a dialog on a dialog. */
function ExpenditureDeskInner({ role, actionConfig }: { readonly role: ExpenditureDeskRole; readonly actionConfig: ActionConfig }) {
  const canClaims = useCan("action:expenditures.claims.approve");
  const canAdvManage = useCan("action:expenditures.advances.manage");
  const canAdvApprove = useCan("action:expenditures.advances.approve");
  const canSalary = useCan("action:salary.view");
  const canLedger = useCan("action:expenditures.manage");
  const { claims } = useClaimsQueue(actionConfig);

  const tabs = (
    [
      { key: "claims" as const, show: canClaims, badge: claims.length },
      { key: "advances" as const, show: canAdvManage || canAdvApprove },
      { key: "salary" as const, show: canSalary },
      { key: "ledger" as const, show: canLedger },
    ] satisfies { key: TabKey; show: boolean; badge?: number }[]
  ).filter((t) => t.show);

  const requested = useSearchParams().get("tab");
  const allowed = tabs.map((t) => t.key);
  const firstTab = allowed[0] ?? null;
  const initial = requested && (allowed as string[]).includes(requested) ? (requested as TabKey) : firstTab;

  // Follow the ?tab= deep-link when it changes (kebab → desk), while still letting
  // a click switch tabs locally (render-time adjust-on-change, no effect).
  const [active, setActive] = useState<TabKey | null>(initial);
  const [prevReq, setPrevReq] = useState(requested);
  if (requested !== prevReq) {
    setPrevReq(requested);
    if (requested && (allowed as string[]).includes(requested)) setActive(requested as TabKey);
  }

  return (
    <DashboardShell role={role} active="expenditures">
      <PageHeader title="Expense desk" subtitle="Approve claims, manage advances, run payroll, and view a person's ledger." />

      {tabs.length === 0 ? (
        <p className="text-sm text-muted-foreground">You don&apos;t have access to any of these areas.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1 border-b border-border">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActive(t.key)}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium",
                  active === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {LABELS[t.key]}
                {t.badge && t.badge > 0 ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-semibold text-white">{t.badge}</span>
                ) : null}
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-border bg-background p-4">
            {active === "claims" ? <ClaimsQueuePanel actionConfig={actionConfig} /> : null}
            {active === "advances" ? <AdvancesPanel actionConfig={actionConfig} /> : null}
            {active === "salary" ? <SalaryPanel actionConfig={actionConfig} /> : null}
            {active === "ledger" ? <EmployeeLedgerDialogBody actionConfig={actionConfig} /> : null}
          </div>
        </>
      )}
    </DashboardShell>
  );
}

export const ExpenditureDesk = withQueryClient(ExpenditureDeskInner);
