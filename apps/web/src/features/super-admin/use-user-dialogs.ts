"use client";

import { useState } from "react";
import type { SuperAdminSetupUser } from "./super-admin-types";

/** Open/close state for the five Users dialogs, plus the Add-dialog remount key
 *  (so it resets on each open). Kept out of the panel for the ≤100-line rule. */
export function useUserDialogs() {
  const [addOpen, setAddOpen] = useState(false);
  const [addKey, setAddKey] = useState(0);
  const [editingUser, setEditingUser] = useState<SuperAdminSetupUser | null>(null);
  const [passwordUser, setPasswordUser] = useState<SuperAdminSetupUser | null>(null);
  const [statusUser, setStatusUser] = useState<SuperAdminSetupUser | null>(null);
  const [sessionsUser, setSessionsUser] = useState<SuperAdminSetupUser | null>(null);

  const openAddUser = () => {
    setAddKey((k) => k + 1);
    setAddOpen(true);
  };

  return {
    state: { addOpen, addKey, editingUser, passwordUser, statusUser, sessionsUser },
    setAddOpen,
    setEditingUser,
    setPasswordUser,
    setStatusUser,
    setSessionsUser,
    openAddUser,
  };
}
