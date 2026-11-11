"use client";

import { type SyntheticEvent, useState } from "react";
import { Input } from "@/components/ui/input";
import { type ActionConfig, apiRequest, errorMessage } from "@/lib/api-client";
import {
  PanelHeader,
  ROLE_DISPLAY,
  type SaveMessage,
  SaveBar,
  SettingRow,
  type SettingsRole,
  type UserProfile,
} from "./settings-shared";
import { SoundAlertsSetting } from "./sound-setting";

const FIELD = "w-full sm:w-72";

export function AccountPanel({
  role,
  profile,
  actionConfig,
}: {
  readonly role: SettingsRole;
  readonly profile: UserProfile;
  readonly actionConfig: ActionConfig;
}) {
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<SaveMessage>(null);

  async function handleSave(e: SyntheticEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setMessage({ type: "error", text: "Name cannot be empty." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await apiRequest(actionConfig, "PATCH", "/me/profile", {
        name: name.trim(),
        phone: phone.trim() || undefined,
      });
      setMessage({ type: "success", text: "Profile updated." });
    } catch (err) {
      setMessage({ type: "error", text: errorMessage(err, "Failed to save.") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave}>
      <PanelHeader title="Account" subtitle="Your name and contact details." />
      <SettingRow label="Full name" description="Shown on records you create.">
        <Input className={FIELD} value={name} onChange={(e) => setName(e.target.value)} />
      </SettingRow>
      <SettingRow label="Email" description="Managed by your sign-in provider.">
        <Input className={`${FIELD} bg-muted text-muted-foreground`} value={profile.email ?? ""} disabled />
      </SettingRow>
      <SettingRow label="Phone">
        <Input
          className={FIELD}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+91 00000 00000"
        />
      </SettingRow>
      <SettingRow label="Role" description="Set by an administrator.">
        <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-sm font-semibold text-muted-foreground">
          {ROLE_DISPLAY[role]}
        </span>
      </SettingRow>
      <SaveBar saving={saving} message={message} />

      {/* Per-browser preferences (not part of the profile save above). */}
      <div className="mt-8 border-t border-border pt-6">
        <h3 className="mb-1 text-sm font-semibold text-foreground">Notifications</h3>
        <SoundAlertsSetting />
      </div>
    </form>
  );
}
