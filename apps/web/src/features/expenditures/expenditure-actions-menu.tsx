"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCan } from "@/features/shell/use-can";
import type { ActionConfig } from "@/lib/api-client";
import { useClaimsQueue } from "./use-claims-queue";

type TabKey = "claims" | "advances" | "salary" | "ledger";

/** The ⋮ menu beside Record Expenditure. Each item deep-links to the Expense desk
 *  page at its tab (no more dialogs). Items are permission-gated; the Claims item
 *  carries a red pending-count badge. */
export function ExpenditureActionsMenu({ actionConfig }: { readonly actionConfig: ActionConfig }) {
  const router = useRouter();
  const canClaims = useCan("action:expenditures.claims.approve");
  const canAdvManage = useCan("action:expenditures.advances.manage");
  const canAdvApprove = useCan("action:expenditures.advances.approve");
  const canSalary = useCan("action:salary.view");
  const canLedger = useCan("action:expenditures.manage");
  const { claims } = useClaimsQueue(actionConfig); // drives the pending badge
  const [menuOpen, setMenuOpen] = useState(false);

  const items: { key: TabKey; label: string; show: boolean; badge?: number }[] = [
    { key: "claims", label: "Claims", show: canClaims, badge: claims.length },
    { key: "advances", label: "Advances", show: canAdvManage || canAdvApprove },
    { key: "salary", label: "Salary & pay", show: canSalary },
    { key: "ledger", label: "Employee ledger", show: canLedger },
  ];
  const visible = items.filter((i) => i.show);
  if (visible.length === 0) return null;

  return (
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
            onClick={() => { setMenuOpen(false); router.push(`/expenditures/desk?tab=${item.key}`); }}
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
  );
}
