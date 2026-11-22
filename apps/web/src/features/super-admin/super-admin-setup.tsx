"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { withQueryClient } from "@/components/data-table/query-provider";
import { PageHeader } from "@/components/page-header";
import { DashboardShell } from "@/features/shell/dashboard-shell";
import { plural } from "@/lib/format";
import { buildUserColumns, userColumns, userSkeleton } from "./users-columns";
import { UsersFilterBar } from "./users-filter-bar";
import { UsersDialogs } from "./users-dialogs";
import { useSuperAdminUsers } from "./use-super-admin-users";
import { useUserDialogs } from "./use-user-dialogs";
import { defaultActionConfig, type SuperAdminActionConfig } from "./super-admin-types";

interface SuperAdminSetupProps {
  readonly actionConfig?: SuperAdminActionConfig;
  /** The signed-in admin's user id — used to block deactivating your own row. */
  readonly currentUserId?: string | null;
}

function SuperAdminSetupInner({
  actionConfig = defaultActionConfig,
  currentUserId = null,
}: SuperAdminSetupProps) {
  const d = useUserDialogs();

  const columns = useMemo(
    () =>
      buildUserColumns({
        currentUserId,
        onEdit: d.setEditingUser,
        onSetPassword: d.setPasswordUser,
        onToggleStatus: d.setStatusUser,
        onManageSessions: d.setSessionsUser,
      }),
    [currentUserId, d.setEditingUser, d.setPasswordUser, d.setStatusUser, d.setSessionsUser],
  );
  const list = useSuperAdminUsers(actionConfig, columns);

  return (
    <>
      <DashboardShell role="SUPER_ADMIN" active="users-teams">
        <PageHeader
          crumbs={[{ label: "Configure" }, { label: "Users" }]}
          title="Users"
          subtitle={list.isLoading ? "Loading…" : `${list.total} user${plural(list.total)}`}
          action={<Button onClick={d.openAddUser}>+ Add User</Button>}
        />

        <UsersFilterBar
          search={list.search}
          setSearch={list.setSearch}
          filterRole={list.filters.role}
          filterStatus={list.filters.status}
          setFilter={list.url.setFilter}
        />

        {list.error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {list.error.message}
          </div>
        )}

        <DataTable
          table={list.table}
          columnCount={userColumns.length}
          isLoading={list.showSkeleton}
          skeleton={userSkeleton}
          pageSize={list.pageSize}
          pageCount={list.pageCount}
          empty={list.url.hasFilters ? "No users match your filters." : "No users yet. Click “Add User” to create one."}
        />
      </DashboardShell>

      <UsersDialogs
        state={d.state}
        actionConfig={actionConfig}
        setAddOpen={d.setAddOpen}
        setEditingUser={d.setEditingUser}
        setPasswordUser={d.setPasswordUser}
        setStatusUser={d.setStatusUser}
        setSessionsUser={d.setSessionsUser}
        onChanged={list.refresh}
      />
    </>
  );
}

export const SuperAdminSetup = withQueryClient(SuperAdminSetupInner);
