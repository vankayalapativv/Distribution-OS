"use client";

import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { withQueryClient } from "@/components/data-table/query-provider";
import { PageHeader } from "@/components/page-header";
import { DashboardShell } from "@/features/shell/dashboard-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { type ActionConfig } from "@/lib/api-client";
import { fetchLocations } from "./stock-api";
import { AdjustPanel, OpeningPanel, StockInPanel, TransferPanel } from "./stock-entry-panels";

type Role = "SUPER_ADMIN" | "MANAGER" | "ACCOUNTANT";
export type EntryType = "in" | "opening" | "transfer" | "adjust";

const TITLE: Record<EntryType, string> = {
  in: "Record stock-in",
  opening: "Opening stock",
  transfer: "Inter-godown transfer",
  adjust: "Stock adjustment",
};

const SUBTITLE: Record<EntryType, string> = {
  in: "Supplier delivery → stock in at a godown. Batch, expiry & shelf location are captured per line.",
  opening: "Seed the starting on-hand for a godown at go-live, with batch, expiry & shelf location.",
  transfer: "Move stock between godowns. Posts −source / +destination.",
  adjust: "Damage, count correction, write-off or expiry. Use a negative quantity to reduce.",
};

/** One focused entry screen per action (no switcher) — the type comes from the route. */
function StockEntryInner({ role, actionConfig, initialType }: Readonly<{ role: Role; actionConfig: ActionConfig; initialType: EntryType }>) {
  const type = initialType;
  const locQ = useQuery({ queryKey: ["stock-locations"], queryFn: () => fetchLocations(actionConfig) });
  const locations = locQ.data ?? [];
  // Stock-in & opening panels inject their "Import from Excel" kebab into the header.
  const [headerAction, setHeaderAction] = useState<ReactNode>(null);
  const props = { actionConfig, locations };

  let body: ReactNode;
  if (locQ.isLoading) {
    body = <div className="flex flex-col gap-3"><Skeleton className="h-28 w-full" /><Skeleton className="h-40 w-full" /></div>;
  } else if (locations.length === 0) {
    body = <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">Add a godown first — stock entry needs at least one godown.</p>;
  } else {
    body = (
      <div className="flex flex-col gap-3">
        {type === "in" && <StockInPanel {...props} onHeaderAction={setHeaderAction} />}
        {type === "opening" && <OpeningPanel {...props} onHeaderAction={setHeaderAction} />}
        {type === "transfer" && <TransferPanel {...props} />}
        {type === "adjust" && <AdjustPanel {...props} />}
      </div>
    );
  }

  return (
    <DashboardShell role={role} active="stock">
      <PageHeader title={TITLE[type]} subtitle={SUBTITLE[type]} action={headerAction} />
      {body}
    </DashboardShell>
  );
}

export const StockEntryPage = withQueryClient(StockEntryInner);
