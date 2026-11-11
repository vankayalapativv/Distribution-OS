"use client";

import { type SyntheticEvent, useState } from "react";
import { PasswordInput } from "@/components/form/password-input";
import { PanelHeader, type SaveMessage, SaveBar } from "./settings-shared";

const FIELD = "w-full sm:w-72";

export function SecurityPanel() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<SaveMessage>(null);

  async function handleSubmit(e: SyntheticEvent) {
    e.preventDefault();
    if (next !== confirm) {
      setMessage({ type: "error", text: "New passwords do not match." });
      return;
    }
    if (next.length < 8) {
      setMessage({ type: "error", text: "New password must be at least 8 characters." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Could not change the password.");
      setMessage({ type: "success", text: "Password changed. Other devices were signed out." });
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Could not change the password." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <PanelHeader title="Security" subtitle="Change the password you use to sign in." />
      <div className="space-y-4">
        <Field label="Current password">
          <PasswordInput
            className={FIELD}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            containerClassName={FIELD}
          />
        </Field>
        <Field label="New password" hint="At least 8 characters.">
          <PasswordInput
            className={FIELD}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            containerClassName={FIELD}
          />
        </Field>
        <Field label="Confirm new password">
          <PasswordInput
            className={FIELD}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            containerClassName={FIELD}
          />
        </Field>
      </div>
      <SaveBar
        saving={saving}
        message={message}
        label="Update password"
        disabled={!current || !next || !confirm}
      />
    </form>
  );
}

function Field({ label, hint, children }: { readonly label: string; readonly hint?: string; readonly children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
