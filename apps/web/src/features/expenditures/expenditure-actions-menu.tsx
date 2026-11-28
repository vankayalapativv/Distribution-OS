"use client";

import { useState } from "react";
import { MoreVertical } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCan } from "@/features/shell/use-can";
import { cn } from "@/lib/utils";
import type { ActionConfig } from "@/lib/api-client";
import { ClaimsQueuePanel } from "./claims-queue-panel";
import { ReimbursementsPanel } from "./reimbursements-panel";
import { AdvancesPanel } from "./advances-panel";
import { SalaryPanel } from "./salary-panel";
import { EmployeeLedgerDialogBody } from "./employee-ledger-dialog";
import { useClaimsQueue } from "./use-claims-queue";

type DialogKey = "claims" | "reimbursements" | "advances" | "salary" | "ledger";

const TITLES: Record<DialogKey, string> = {
  claims: "Claims",
  reimbursements: "Reimbursements to pay",
  advances: "Advances",
  salary: "Salary & pay",
  ledger: "Employee ledger",
};

/** The ⋮ menu beside Record Expenditure — each item opens a dialog (with a
 *  context-aware shimmer while it loads). Items are permission-gated; the Claims
 *  item carries a red pending-count badge. */
export function ExpenditureActionsMenu({ actionConfig }: { readonly actionConfig: ActionConfig }) {
  const canClaims = useCan("action:expenditures.claims.approve");
  const canReimb = useCan("action:expenditures.reimbursements.pay");
  const canAdvManage = useCan("action:expenditures.advances.manage");
  const canAdvApprove = useCan("action:expenditures.advances.approve");
  const canSalary = useCan("action:salary.view");
  const canLedger = useCan("action:expenditures.manage");
  const { claims } = useClaimsQueue(actionConfig); // drives the pending badge
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogKey | null>(null);

  const items: { key: DialogKey; label: string; show: boolean; badge?: number }[] = [
    { key: "claims", label: "Claims", show: canClaims, badge: claims.length },
    { key: "reimbursements", label: "Reimbursements", show: canReimb },
    { key: "advances", label: "Advances", show: canAdvManage || canAdvApprove },
    { key: "salary", label: "Salary & pay", show: canSalary },
    { key: "ledger", label: "Employee ledger", show: canLedger },
  ];
  const visible = items.filter((i) => i.show);
  if (visible.length === 0) return null;

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger
          title="Expense actions"
          aria-label="Expense actions"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <MoreVertical className="size-4" />
        </PopoverTrigger>
        <PopoverContent align="end" side="bottom" className="w-56 gap-0.5 p-1.5">
          {visible.map((item) => (
            <button
              key={item.key}
              type="button"
              className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-foreground hover:bg-accent"
              onClick={() => { setMenuOpen(false); setDialog(item.key); }}
            >
              <span>{item.label}</span>
              {item.badge && item.badge > 0 ? (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-semibold text-white">
                  {item.badge}
                </span>
              ) : null}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent size="lg" className={cn("max-h-[85vh]")}>
          <DialogHeader>
            <DialogTitle>{dialog ? TITLES[dialog] : ""}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {dialog === "claims" ? <ClaimsQueuePanel actionConfig={actionConfig} /> : null}
            {dialog === "reimbursements" ? <ReimbursementsPanel actionConfig={actionConfig} /> : null}
            {dialog === "advances" ? <AdvancesPanel actionConfig={actionConfig} /> : null}
            {dialog === "salary" ? <SalaryPanel actionConfig={actionConfig} /> : null}
            {dialog === "ledger" ? <EmployeeLedgerDialogBody actionConfig={actionConfig} /> : null}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}
