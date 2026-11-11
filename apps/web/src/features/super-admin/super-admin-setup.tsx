"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DashboardShell } from "@/features/shell/dashboard-shell";
import { AddUserDialog } from "./super-admin-add-user-dialog";
import { UsersSection } from "./super-admin-sections";
import { EditUserDialog } from "./super-admin-edit-user-dialog";
import { SetPasswordDialog } from "./super-admin-password-dialog";
import { StatusDialog } from "./super-admin-status-dialog";
import { SessionsDialog } from "./super-admin-sessions-dialog";
import {
  defaultActionConfig,
  type SuperAdminActionConfig,
  type SuperAdminSetupData,
  type SuperAdminSetupUser,
} from "./super-admin-types";

export type {
  CreatedCredentials,
  CreatedUser,
  CreateUserPayload,
  SuperAdminActionConfig,
  SuperAdminSetupData,
  SuperAdminSetupRole,
  SuperAdminSetupUser,
} from "./super-admin-types";

interface SuperAdminSetupProps {
  readonly setupData: SuperAdminSetupData;
  readonly actionConfig?: SuperAdminActionConfig;
  /** The signed-in admin's user id — used to block deactivating your own row. */
  readonly currentUserId?: string | null;
}

export function SuperAdminSetup({
  setupData,
  actionConfig = defaultActionConfig,
  currentUserId = null,
}: SuperAdminSetupProps) {
  const [users, setUsers] = useState(setupData.users);

  // No user cap — billing is seat-based (₹708 per active user), so the team can
  // grow freely and each active user is billed.

  // The Add dialog resets on open via a remount key (matches the prior open* reset).
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [addUserKey, setAddUserKey] = useState(0);
  const [editingUser, setEditingUser] = useState<SuperAdminSetupUser | null>(null);
  const [passwordUser, setPasswordUser] = useState<SuperAdminSetupUser | null>(null);
  const [statusUser, setStatusUser] = useState<SuperAdminSetupUser | null>(null);
  const [sessionsUser, setSessionsUser] = useState<SuperAdminSetupUser | null>(null);

  const applyUpdate = (updated: SuperAdminSetupUser) =>
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));

  function openAddUser() {
    setAddUserKey((k) => k + 1);
    setAddUserOpen(true);
  }

  return (
    <>
      <DashboardShell
        role="SUPER_ADMIN"
        active="users-teams"
        contentClassName="min-w-0 flex-1 overflow-y-auto px-8 py-7"
      >
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4 pb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Users</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Add and edit users, and set their passwords.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={openAddUser}>
              Add User
            </Button>
          </div>
        </header>

        <UsersSection
          users={users}
          currentUserId={currentUserId}
          onEdit={setEditingUser}
          onSetPassword={setPasswordUser}
          onToggleStatus={setStatusUser}
          onManageSessions={setSessionsUser}
        />
      </DashboardShell>

      <AddUserDialog
        key={`user-${addUserKey}`}
        open={addUserOpen}
        onOpenChange={setAddUserOpen}
        actionConfig={actionConfig}
        onUserCreated={(user) => setUsers((prev) => [...prev, user])}
      />

      <EditUserDialog
        user={editingUser}
        onClose={() => setEditingUser(null)}
        onSaved={applyUpdate}
        actionConfig={actionConfig}
      />

      <SetPasswordDialog
        user={passwordUser}
        onClose={() => setPasswordUser(null)}
      />

      <StatusDialog
        user={statusUser}
        actionConfig={actionConfig}
        onClose={() => setStatusUser(null)}
        onUpdated={applyUpdate}
      />

      <SessionsDialog
        user={sessionsUser}
        actionConfig={actionConfig}
        onClose={() => setSessionsUser(null)}
      />
    </>
  );
}
