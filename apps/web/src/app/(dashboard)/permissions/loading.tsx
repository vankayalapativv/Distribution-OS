import { Search } from "lucide-react";
import { DashboardShell } from "@/features/shell/dashboard-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PanelSkeleton } from "@/features/permissions/permission-skeleton";

/**
 * Route-level loading UI for the Permissions page (SUPER_ADMIN only), shown while
 * the server component runs its auth + matrix fetch. The chrome that doesn't
 * depend on data — the PageHeader with its Save button and the search box —
 * renders as the REAL (disabled) controls; only the two role cards shimmer,
 * reusing `PanelSkeleton` so the shapes track the live panels.
 */
export default function Loading() {
  return (
    <DashboardShell role="SUPER_ADMIN" active="permissions">
      <div className="flex w-full flex-col gap-5">
        <PageHeader
          title="Permissions"
          subtitle="Control what Managers and Accountants can access. Super Admin always has full access."
          action={
            <Button size="sm" disabled>
              Save changes
            </Button>
          }
        />

        <div className="flex flex-col gap-4">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search capabilities…" className="pl-8" disabled aria-label="Search capabilities" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <PanelSkeleton />
            <PanelSkeleton />
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
