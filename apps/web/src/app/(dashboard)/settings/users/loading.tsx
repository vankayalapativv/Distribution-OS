import { DashboardShell } from "@/features/shell/dashboard-shell";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const COLUMNS = ["User", "Contact", "Role", "Status", "Actions"] as const;
const ROW_COUNT = 8;

/** One shimmer row mirroring the Users table: avatar + name, contact line,
 *  role pill, status pill, and the right-aligned Edit / Set password actions. */
function UserRowSkeleton() {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <Skeleton className="h-3.5 w-32" />
        </div>
      </TableCell>
      <TableCell>
        <Skeleton className="h-3.5 w-48" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-24 rounded-full" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-14 rounded-full" />
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-3">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-24" />
        </div>
      </TableCell>
    </TableRow>
  );
}

/**
 * Route-level loading UI for the Users page (SUPER_ADMIN only). Shown the
 * instant the page is navigated to, until the server fetch (getSuperAdminSetup)
 * resolves. Renders inside the dashboard shell (the app has no dashboard
 * layout, so the shell lives here too) and mirrors the real layout: header →
 * table card (filters + an 8-row context-aware shimmer matching the columns).
 */
export default function Loading() {
  return (
    <DashboardShell
      role="SUPER_ADMIN"
      active="users-teams"
      contentClassName="min-w-0 flex-1 overflow-y-auto px-8 py-7"
    >
      {/* Header: title + subtitle + Add User */}
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4 pb-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-8 w-24 rounded-md" />
      </header>

      {/* Users table card */}
      <section className="mb-8 rounded-lg border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <Skeleton className="h-4 w-16" />
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-9 w-56 rounded-md" />
            <Skeleton className="h-9 w-[150px] rounded-md" />
            <Skeleton className="h-9 w-[140px] rounded-md" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                {COLUMNS.map((c) => (
                  <TableHead key={c} className={c === "Actions" ? "text-right" : undefined}>
                    {c}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: ROW_COUNT }).map((_, i) => (
                <UserRowSkeleton key={i} />
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </DashboardShell>
  );
}
