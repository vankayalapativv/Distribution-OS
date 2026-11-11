"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SearchSelect } from "@/components/ui/search-select";
import {
  contactLine,
  ROLE_LABELS,
  statusClass,
  type SuperAdminSetupUser,
} from "./super-admin-types";
import { UserActionsMenu } from "./super-admin-user-actions-menu";

const ROLE_OPTIONS = [
  { value: "all", label: "All roles" },
  ...Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label })),
];
const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

/** Up to two uppercase initials from a name, for the avatar chip. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** A subtle per-role badge; SUPER_ADMIN gets the primary tint. */
function RoleBadge({ role }: { readonly role: string }) {
  const isAdmin = role === "SUPER_ADMIN";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        isAdmin ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
      }`}
    >
      {ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role}
    </span>
  );
}

/** Client-side filter over the already-loaded users (search + role + status). */
function filterUsers(
  users: SuperAdminSetupUser[],
  q: string,
  role: string,
  status: string,
): SuperAdminSetupUser[] {
  const query = q.trim().toLowerCase();
  return users.filter((u) => {
    if (role !== "all" && !u.roles.includes(role as SuperAdminSetupUser["roles"][number])) return false;
    if (status !== "all" && u.status !== status) return false;
    if (!query) return true;
    return (
      u.name.toLowerCase().includes(query) || contactLine(u).toLowerCase().includes(query)
    );
  });
}

export function StatusBadge({ status }: { readonly status: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClass(status)}`}>
      {status}
    </span>
  );
}

export function UsersSection({
  users,
  currentUserId,
  onEdit,
  onSetPassword,
  onToggleStatus,
  onManageSessions,
}: {
  readonly users: SuperAdminSetupUser[];
  readonly currentUserId: string | null;
  readonly onEdit: (user: SuperAdminSetupUser) => void;
  readonly onSetPassword: (user: SuperAdminSetupUser) => void;
  readonly onToggleStatus: (user: SuperAdminSetupUser) => void;
  readonly onManageSessions: (user: SuperAdminSetupUser) => void;
}) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const filtered = filterUsers(users, q, role, status);

  return (
    <section className="mb-8 rounded-lg border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <h2 className="text-sm font-semibold text-card-foreground">
          Users
          {users.length > 0 && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {filtered.length === users.length
                ? `${users.length}`
                : `${filtered.length} of ${users.length}`}
            </span>
          )}
        </h2>
        {users.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-56">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, email or phone…"
                className="h-9 bg-background pl-8"
              />
            </div>
            <div className="w-[150px]">
              <SearchSelect
                items={ROLE_OPTIONS}
                valueKey={role}
                getKey={(o) => o.value}
                getLabel={(o) => o.label}
                onSelect={setRole}
                placeholder="All roles"
                searchPlaceholder="Search role…"
                emptyText="No role found"
                contentClassName="w-[200px] p-0"
              />
            </div>
            <div className="w-[140px]">
              <SearchSelect
                items={STATUS_OPTIONS}
                valueKey={status}
                getKey={(o) => o.value}
                getLabel={(o) => o.label}
                onSelect={setStatus}
                placeholder="All statuses"
                searchPlaceholder="Search…"
                emptyText="No status found"
                contentClassName="w-[160px] p-0"
              />
            </div>
          </div>
        )}
      </div>
      {(() => { if (users.length === 0) return (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          No users yet. Click “Add User” to create one.
        </p>
      ); if (filtered.length === 0) return (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          No users match your filters.
        </p>
      ); return (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead>User</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {initials(user.name)}
                      </span>
                      <span className="font-medium text-card-foreground">{user.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-foreground">{user.email ?? "—"}</span>
                      <span className="text-xs text-muted-foreground">{user.phone ?? "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((r) => (
                        <RoleBadge key={r} role={r} />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={user.status} />
                  </TableCell>
                  <TableCell>
                    <UserActionsMenu
                      user={user}
                      isSelf={user.id === currentUserId}
                      onEdit={() => onEdit(user)}
                      onSetPassword={() => onSetPassword(user)}
                      onToggleStatus={() => onToggleStatus(user)}
                      onManageSessions={() => onManageSessions(user)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ); })()}
    </section>
  );
}

