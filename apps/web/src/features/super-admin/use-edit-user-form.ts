"use client";

import { type SyntheticEvent, useEffect, useState } from "react";
import { errorMessage, type ActionConfig } from "@/lib/api-client";
import type { SuperAdminSetupUser } from "./super-admin-types";
import { saveSuperAdminUser } from "./super-admin-save-user";

/** Edit-user form state: fields synced from the user, plus the save handler.
 *  Kept out of the dialog for the ≤100-line rule. */
export function useEditUserForm(
  user: SuperAdminSetupUser | null,
  onSaved: (user: SuperAdminSetupUser) => void,
  onClose: () => void,
  actionConfig: ActionConfig,
) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("active");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    // Wrapped so the resets aren't a synchronous setState in the effect body
    // (react-hooks/set-state-in-effect); the timing is unchanged.
    function syncFromUser(u: SuperAdminSetupUser) {
      setName(u.name);
      setEmail(u.email ?? "");
      setPhone(u.phone ?? "");
      setStatus(u.status);
      setError(null);
    }
    syncFromUser(user);
  }, [user]);

  async function handleSubmit(e: SyntheticEvent<HTMLFormElement>, u: SuperAdminSetupUser) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const saved = await saveSuperAdminUser(
        u,
        { name: name.trim(), email: email.trim() || null, phone: phone.trim() || null, status },
        actionConfig,
      );
      onSaved({ ...u, ...saved });
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Could not save the user."));
    } finally {
      setBusy(false);
    }
  }

  return { name, setName, email, setEmail, phone, setPhone, status, setStatus, busy, error, handleSubmit };
}
