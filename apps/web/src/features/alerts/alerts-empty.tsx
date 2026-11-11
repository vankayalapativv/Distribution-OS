import { CheckCircle2 } from "lucide-react";
import type { AlertStatusFilter } from "./use-alerts";

/** Empty-state card for the alerts list (friendlier wording for the "open" tab). */
export function AlertsEmpty({ statusFilter }: { readonly statusFilter: AlertStatusFilter }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-6 py-16 text-center">
      <CheckCircle2 className="mx-auto mb-3 text-green-500" size={32} />
      <p className="text-sm font-medium text-foreground">
        {statusFilter === "open" ? "No open alerts." : "No alerts."}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {statusFilter === "open" && "All caught up — everything looks good."}
      </p>
    </div>
  );
}
