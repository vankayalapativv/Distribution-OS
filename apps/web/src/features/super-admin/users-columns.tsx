import type { ColumnDef } from "@tanstack/react-table";
import { StatusBadge } from "@/components/status-badge";
import type { SuperAdminSetupUser } from "./super-admin-types";
import { USER_STATUS_TONES } from "./super-admin-list-logic";
import { UserActionsMenu } from "./super-admin-user-actions-menu";
import { initials, RoleBadge } from "./users-columns-cells";

// Skeleton + cells kept in siblings for the ≤100-line rule; re-exported so
// importers of `./users-columns` keep working.
export { userSkeleton } from "./users-columns-skeleton";

export interface UserColumnsOptions {
  currentUserId?: string | null;
  onEdit?: (user: SuperAdminSetupUser) => void;
  onSetPassword?: (user: SuperAdminSetupUser) => void;
  onToggleStatus?: (user: SuperAdminSetupUser) => void;
  onManageSessions?: (user: SuperAdminSetupUser) => void;
}

export function buildUserColumns(opts: UserColumnsOptions = {}): ColumnDef<SuperAdminSetupUser>[] {
  return [
    {
      accessorKey: "name",
      header: "User",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {initials(row.original.name)}
          </span>
          <span className="font-medium">{row.original.name}</span>
        </div>
      ),
    },
    {
      id: "contact",
      header: "Contact",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span>{row.original.email ?? "—"}</span>
          <span className="text-xs text-muted-foreground">{row.original.phone ?? "—"}</span>
        </div>
      ),
    },
    {
      id: "role",
      header: "Role",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.roles.map((r) => (
            <RoleBadge key={r} role={r} />
          ))}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => <StatusBadge status={getValue() as string} tones={USER_STATUS_TONES} />,
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      meta: { className: "text-right" },
      cell: ({ row }) => (
        <UserActionsMenu
          user={row.original}
          isSelf={row.original.id === opts.currentUserId}
          onEdit={() => opts.onEdit?.(row.original)}
          onSetPassword={() => opts.onSetPassword?.(row.original)}
          onToggleStatus={() => opts.onToggleStatus?.(row.original)}
          onManageSessions={() => opts.onManageSessions?.(row.original)}
        />
      ),
    },
  ];
}

/** Default columns (no row-action callbacks) — used for column count + tests. */
export const userColumns = buildUserColumns();
