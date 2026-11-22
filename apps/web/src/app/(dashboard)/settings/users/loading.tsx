"use client";

import { DashboardShell } from "@/features/shell/dashboard-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UsersFilterBar } from "@/features/super-admin/users-filter-bar";
import { userSkeleton } from "@/features/super-admin/users-columns";

const COLUMNS = ["User", "Contact", "Role", "Status", ""] as const;
const ROW_COUNT = 8;
const noop = () => {};

/**
 * Route-level loading UI for the Users page (SUPER_ADMIN only), shown during the
 * server component's auth step. The chrome that doesn't depend on data — the
 * PageHeader + Add User button and the search / role / status filter bar — renders
 * as the REAL controls (matching the live page); only the table rows shimmer,
 * reusing the table's own `userSkeleton` so the shapes track the columns.
 */
export default function Loading() {
  return (
    <DashboardShell role="SUPER_ADMIN" active="users-teams">
      <PageHeader
        title="Users"
        subtitle={<Skeleton className="h-4 w-20" />}
        action={<Button>+ Add User</Button>}
      />

      <UsersFilterBar search="" setSearch={noop} filterRole="" filterStatus="" setFilter={noop} />

      <div className="overflow-hidden rounded-lg border border-border bg-white">
        <Table className="min-w-max">
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              {COLUMNS.map((c, i) => (
                <TableHead key={c || "actions"} className={i === COLUMNS.length - 1 ? "text-right" : undefined}>
                  {c}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: ROW_COUNT }).map((_, r) => (
              <TableRow key={r} className="hover:bg-transparent">
                {userSkeleton.map((cell, i) => (
                  <TableCell key={i} className={i === userSkeleton.length - 1 ? "text-right" : undefined}>
                    {cell()}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </DashboardShell>
  );
}
