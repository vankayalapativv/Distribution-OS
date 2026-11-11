import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { toLocalPhone, toStoredPhone } from "../components/phone-field";
import { apiFetch } from "./api";
import { useAuth } from "./auth";

interface Profile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

/** Form state + save for the edit-profile screen (email stays fixed). */
export function useEditProfile() {
  const token = useAuth((s) => s.token);
  const updateUser = useAuth((s) => s.updateUser);

  const profileQuery = useQuery({
    queryKey: ["me", "profile"],
    queryFn: () => apiFetch<Profile>("/me/profile", { token }),
    enabled: Boolean(token),
    // Always show the live server values (never a stale cache after a save).
    staleTime: 0,
    refetchOnMount: "always",
  });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Seed the form once the profile loads (phone → 10-digit local part).
  useEffect(() => {
    if (profileQuery.data) {
      setName(profileQuery.data.name ?? "");
      setPhone(toLocalPhone(profileQuery.data.phone));
    }
  }, [profileQuery.data]);

  const trimmedName = name.trim();
  const dirty =
    profileQuery.data != null &&
    (trimmedName !== (profileQuery.data.name ?? "") ||
      phone !== toLocalPhone(profileQuery.data.phone));
  // `!saved` blocks a second PATCH during the post-success navigation delay.
  const canSave = trimmedName.length > 0 && dirty && !busy && !saved;
  const phoneConflict = /phone number|already used/i.test(error ?? "");

  function onNameChange(t: string) {
    setName(t);
    if (error) setError(null);
  }

  function onPhoneChange(d: string) {
    setPhone(d);
    if (error) setError(null);
  }

  async function onSave() {
    if (!canSave) return;
    // Optional, but if present it must be a full 10-digit number (matches the
    // customer forms' phone rule).
    if (phone.length > 0 && phone.length !== 10) {
      setError("Enter a valid 10-digit phone number.");
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await apiFetch<Profile>("/me/profile", {
        method: "PATCH",
        token,
        body: { name: trimmedName, phone: toStoredPhone(phone) },
      });
      await updateUser({ name: updated.name });
      setSaved(true);
      setTimeout(() => router.back(), 600);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return {
    profileQuery, name, onNameChange, phone, onPhoneChange,
    busy, error, saved, canSave, phoneConflict, onSave,
  };
}
