import type { ReactNode } from "react";

export type SettingsRole = "SUPER_ADMIN" | "MANAGER" | "ACCOUNTANT";

export interface UserProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

import type { CompanyProfile } from "@/lib/company";
export type { CompanyProfile };

export interface SystemSettings {
  creditOverdueDays: number;
  company: CompanyProfile;
}

export const ROLE_DISPLAY: Record<SettingsRole, string> = {
  SUPER_ADMIN: "Super Admin",
  MANAGER: "Manager",
  ACCOUNTANT: "Accountant",
};

export type SaveMessage = { type: "success" | "error"; text: string } | null;

/** Panel header — the title + one-line description at the top of a section. */
export function PanelHeader({ title, subtitle }: Readonly<{ title: string; subtitle?: string }>) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

/** A label / description on the left, its control on the right, with a divider.
 *  Stacks to one column on narrow widths. */
export function SettingRow({
  label,
  description,
  children,
}: Readonly<{
  label: string;
  description?: ReactNode;
  children: ReactNode;
}>) {
  return (
    <div className="flex flex-col gap-2 border-b border-border/70 py-4 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0 sm:pt-1.5">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {description && <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      <div className="w-full flex-none sm:w-auto">{children}</div>
    </div>
  );
}

/** A small "system-managed" read-only pill used for fixed operational rules. */
export function ReadOnlyPill({ icon, children }: Readonly<{ icon?: ReactNode; children: ReactNode }>) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-1.5 text-sm font-semibold text-foreground">
      {icon}
      {children}
    </span>
  );
}

/** The Save button + inline status message shared by every editable panel. */
export function SaveBar({
  saving,
  message,
  label = "Save changes",
  disabled,
}: Readonly<{
  saving: boolean;
  message: SaveMessage;
  label?: string;
  disabled?: boolean;
}>) {
  return (
    <div className="mt-6 flex items-center gap-3">
      <button
        type="submit"
        disabled={saving || disabled}
        className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {saving ? "Saving…" : label}
      </button>
      {message && (
        <span className={`text-xs ${message.type === "success" ? "text-green-600" : "text-red-600"}`}>
          {message.text}
        </span>
      )}
    </div>
  );
}
