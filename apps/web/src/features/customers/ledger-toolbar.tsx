"use client";

import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { ChevronDown, Download, Plus, RotateCcw, Wallet } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { type ActionConfig } from "@/lib/api-client";
import { LedgerDateRange, type LedgerPreset } from "./customer-ledger-range";
import { CustomerNewOrderButton } from "./customer-new-order-button";
import { CustomerNewCollectionButton } from "./customer-new-collection-button";
import type { LedgerActions } from "./ledger-types";

function MenuItem({ icon: Icon, label, onClick, disabled }: {
  readonly icon: typeof Plus;
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
    >
      <Icon className="size-4 text-muted-foreground" /> {label}
    </button>
  );
}

/** Date-range filter + New Order / New Collection + the Actions overflow menu. */
export function LedgerToolbar({
  customerId,
  customerName,
  actionConfig,
  range,
  actions,
}: {
  readonly customerId: string;
  readonly customerName: string;
  readonly actionConfig: ActionConfig;
  readonly range: {
    from: string;
    to: string;
    preset: LedgerPreset;
    open: boolean;
    onOpenChange: (o: boolean) => void;
    onPreset: (p: Exclude<LedgerPreset, "custom">) => void;
    onCalendar: (sel: DateRange | undefined) => void;
  };
  readonly actions: LedgerActions;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const close = (fn: () => void) => () => {
    setMenuOpen(false);
    fn();
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <LedgerDateRange {...range} />
      <div className="ml-auto flex items-center gap-2">
        {actions.canCreateOrder && (
          <CustomerNewOrderButton customerId={customerId} customerName={customerName} actionConfig={actionConfig} variant="outline" />
        )}
        {actions.canCreateCollection && (
          <CustomerNewCollectionButton customerId={customerId} customerName={customerName} actionConfig={actionConfig} />
        )}
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-white px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent focus:outline-none data-[popup-open]:bg-accent">
            Actions
            <ChevronDown className="size-4 opacity-60" />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 gap-0.5 p-1">
            {actions.canCreateReturn && <MenuItem icon={RotateCcw} label="New Sales Return" onClick={close(actions.onReturn)} />}
            {actions.canCreateCreditNote && <MenuItem icon={Plus} label="New Credit Note" onClick={close(actions.onCreditNote)} />}
            {actions.canManageOpening && <MenuItem icon={Wallet} label="Manage Opening Balance" onClick={close(actions.onOpening)} />}
            <MenuItem
              icon={Download}
              label={actions.downloading ? "Preparing…" : "Download PDF"}
              onClick={close(actions.onDownload)}
              disabled={actions.downloadDisabled}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
