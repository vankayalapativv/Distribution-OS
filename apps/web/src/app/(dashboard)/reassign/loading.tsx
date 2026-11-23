import { DashboardShell } from "@/features/shell/dashboard-shell";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ReassignListRowSkeleton } from "@/features/reassign/reassign-list-row-skeleton";
import { ReassignDetailSkeleton } from "@/features/reassign/reassign-detail-skeleton";

const ROW_COUNT = 8;

/**
 * Route-level loading UI for the Reassign page (SUPER_ADMIN only), shown while the
 * server component fetches the customer list. Mirrors the real workbench — the
 * PageHeader, the list card (search + owner filter + shimmer rows) and the detail
 * panel — using the same skeletons the live view uses, so the shapes match.
 */
export default function Loading() {
  return (
    <DashboardShell role="SUPER_ADMIN" active="reassign">
      <PageHeader
        crumbs={[{ label: "Configure" }, { label: "Reassign Customers" }]}
        title="Reassign Customers"
        subtitle="Browse customers, see who owns each, and move a customer — and all of their history — to another sales executive."
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(320px,420px)_1fr]">
        <section className="h-fit rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-card-foreground">Customers</h2>
            <Skeleton className="h-3 w-8" />
          </div>
          <div className="flex gap-2 border-b border-border p-3">
            <Skeleton className="h-9 flex-1 rounded-md" />
            <Skeleton className="h-9 w-[150px] rounded-md" />
          </div>
          <div>
            {Array.from({ length: ROW_COUNT }).map((_, i) => (
              <ReassignListRowSkeleton key={i} />
            ))}
          </div>
        </section>
        <ReassignDetailSkeleton />
      </div>
    </DashboardShell>
  );
}
