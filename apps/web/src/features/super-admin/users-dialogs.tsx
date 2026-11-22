"use client";

import { AddUserDialog } from "./super-admin-add-user-dialog";
import { EditUserDialog } from "./super-admin-edit-user-dialog";
import { SetPasswordDialog } from "./super-admin-password-dialog";
import { StatusDialog } from "./super-admin-status-dialog";
import { SessionsDialog } from "./super-admin-sessions-dialog";
import type { SuperAdminActionConfig, SuperAdminSetupUser } from "./super-admin-types";

export interface UsersDialogsState {
  addOpen: boolean;
  addKey: number;
  editingUser: SuperAdminSetupUser | null;
  passwordUser: SuperAdminSetupUser | null;
  statusUser: SuperAdminSetupUser | null;
  sessionsUser: SuperAdminSetupUser | null;
}

/** All five Users dialogs. `onChanged` re-pulls the list after a create/edit/
 *  status change (TanStack Query owns the rows — no local list state). */
export function UsersDialogs({
  state,
  actionConfig,
  setAddOpen,
  setEditingUser,
  setPasswordUser,
  setStatusUser,
  setSessionsUser,
  onChanged,
}: Readonly<{
  state: UsersDialogsState;
  actionConfig: SuperAdminActionConfig;
  setAddOpen: (open: boolean) => void;
  setEditingUser: (user: SuperAdminSetupUser | null) => void;
  setPasswordUser: (user: SuperAdminSetupUser | null) => void;
  setStatusUser: (user: SuperAdminSetupUser | null) => void;
  setSessionsUser: (user: SuperAdminSetupUser | null) => void;
  onChanged: () => void;
}>) {
  return (
    <>
      <AddUserDialog
        key={`user-${state.addKey}`}
        open={state.addOpen}
        onOpenChange={setAddOpen}
        actionConfig={actionConfig}
        onUserCreated={onChanged}
      />
      <EditUserDialog
        user={state.editingUser}
        onClose={() => setEditingUser(null)}
        onSaved={onChanged}
        actionConfig={actionConfig}
      />
      <SetPasswordDialog user={state.passwordUser} onClose={() => setPasswordUser(null)} />
      <StatusDialog
        user={state.statusUser}
        actionConfig={actionConfig}
        onClose={() => setStatusUser(null)}
        onUpdated={onChanged}
      />
      <SessionsDialog
        user={state.sessionsUser}
        actionConfig={actionConfig}
        onClose={() => setSessionsUser(null)}
      />
    </>
  );
}
