"use client";

import { type SyntheticEvent, useState } from "react";
import { errorMessage } from "@/lib/api-client";
import type {
  CreatedCredentials,
  CreatedUser,
  CreateUserPayload,
  SuperAdminSetupUser,
} from "./super-admin-types";

/**
 * All Add-user state + behaviour: the controlled form fields, the create call
 * (through the same-origin admin BFF), the SUPER_ADMIN confirm gate, and the
 * one-time credentials + copy. Kept out of the dialog for the ≤100-line rule.
 */
export function useAddUser(onUserCreated: (user: SuperAdminSetupUser) => void) {
  const [userRole, setUserRole] = useState("SALES_EXECUTIVE");
  // Controlled so the values survive the Super Admin confirmation step (the form unmounts there).
  const [userName, setUserName] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<CreatedCredentials | null>(null);
  const [copied, setCopied] = useState(false);
  // When creating a SUPER_ADMIN, hold the payload here and require an explicit confirm first.
  const [pendingSuperAdmin, setPendingSuperAdmin] = useState<CreateUserPayload | null>(null);

  function handleCreateUser(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setUserFormError(null);
    const trimmedEmail = userEmail.trim();
    const trimmedPhone = userPhone.trim();
    const payload: CreateUserPayload = {
      name: userName.trim(),
      email: trimmedEmail === "" ? null : trimmedEmail,
      phone: trimmedPhone === "" ? null : trimmedPhone,
      role: userRole,
    };
    // Creating another Super Admin grants full system access — require an explicit confirm.
    if (payload.role === "SUPER_ADMIN") {
      setPendingSuperAdmin(payload);
      return;
    }
    void submitUser(payload);
  }

  async function submitUser(payload: CreateUserPayload) {
    setIsCreatingUser(true);
    setUserFormError(null);
    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const user = (await res.json()) as CreatedUser & { error?: string };
      if (!res.ok) throw new Error(user.error ?? "User creation failed.");
      onUserCreated({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        status: user.status,
        appLoginId: user.appLoginId,
        roles: [user.role],
      });
      setCreatedCredentials({ email: user.email ?? "", password: user.generatedPassword, name: user.name });
    } catch (error) {
      setUserFormError(errorMessage(error, "User creation failed."));
    } finally {
      setIsCreatingUser(false);
      setPendingSuperAdmin(null);
    }
  }

  async function copyCredentials(creds: CreatedCredentials) {
    const text = `Name: ${creds.name}\nEmail: ${creds.email}\nPassword: ${creds.password}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  return {
    userRole, setUserRole, userName, setUserName, userPhone, setUserPhone, userEmail, setUserEmail,
    isCreatingUser, userFormError, createdCredentials, copied, pendingSuperAdmin, setPendingSuperAdmin,
    handleCreateUser, submitUser, copyCredentials,
  };
}
