"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { apiGet, type ActionConfig } from "@/lib/api-client";
import type { CustomerDetailRole } from "./customer-detail";
import { OpeningForm } from "./opening-balance-form";
import type { OpeningBalance } from "./opening-balance-logic";

export type { OpeningBalance } from "./opening-balance-logic";

export function OpeningBalanceDialog({
  open,
  onOpenChange,
  customerId,
  role,
  actionConfig,
  onChanged,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly customerId: string;
  readonly role: CustomerDetailRole;
  readonly actionConfig: ActionConfig;
  readonly onChanged?: () => void;
}) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["opening-balance", customerId],
    queryFn: () =>
      apiGet<{ openingBalance: OpeningBalance | null }>(
        actionConfig,
        `/customers/${customerId}/opening-balance`,
      ),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        {query.isLoading || !query.data ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : (
          <OpeningForm
            customerId={customerId}
            role={role}
            actionConfig={actionConfig}
            initial={query.data.openingBalance}
            onDone={() => {
              void queryClient.invalidateQueries({ queryKey: ["opening-balance", customerId] });
              void queryClient.invalidateQueries({ queryKey: ["customer-ledger", customerId] });
              onChanged?.();
              onOpenChange(false);
            }}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
