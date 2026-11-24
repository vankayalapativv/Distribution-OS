"use client";

import { CockpitProfileForm, type ProfileValues } from "./cockpit-profile-form";
import { CockpitSettingsForm, type SettingField } from "./cockpit-settings-form";
import { CockpitInvoiceForm } from "./cockpit-invoice-form";
import { CockpitGodownsForm, type GodownRow } from "./cockpit-godowns-form";
import { CockpitDuesForm, type DuesBandRow } from "./cockpit-dues-form";

const ADMIN_FIELDS: SettingField[] = [{ key: "admin_designation", label: "Designation" }];

const BANK_FIELDS: SettingField[] = [
  { key: "company_bank_name", label: "Bank name" },
  { key: "company_bank_account_name", label: "Account holder" },
  { key: "company_bank_account_number", label: "Account number", mono: true },
  { key: "company_bank_ifsc", label: "IFSC", mono: true },
  { key: "company_upi_id", label: "UPI ID", mono: true },
];

const TRACKING_FIELDS: SettingField[] = [
  { key: "tracking_se_autostop_hour", label: "SE auto-stop hour (0–24)", mono: true },
  { key: "tracking_logistics_autostop_hour", label: "Logistics auto-stop hour (0–24)", mono: true },
];

/**
 * Full editable view of an enterprise's onboarding details, shown in place of the
 * read-only sections. Each section saves on its own (to its own endpoint) and the
 * panel stays open, so the owner can edit several sections in turn. `onSave`
 * posts the section payload and refetches; it returns whether the save succeeded.
 */
export function CockpitEditPanel({
  profile,
  settings,
  invoice,
  godowns,
  duesBands,
  busy,
  onSave,
}: {
  profile: ProfileValues;
  settings: Record<string, string>;
  invoice: { prefix: string; finYear: string; nextSeq: number | null };
  godowns: GodownRow[];
  duesBands: DuesBandRow[];
  busy?: boolean;
  onSave: (payload: Record<string, unknown>) => Promise<boolean>;
}) {
  return (
    <div className="flex flex-col gap-3">
      <CockpitProfileForm initial={profile} busy={busy} onSave={(changed) => void onSave({ action: "profile", ...changed })} />
      <CockpitSettingsForm title="Administrator" fields={ADMIN_FIELDS} settings={settings} busy={busy} onSave={onSave} />
      <CockpitSettingsForm title="Banking & payment" fields={BANK_FIELDS} settings={settings} busy={busy} onSave={onSave} />
      <CockpitInvoiceForm
        prefix={invoice.prefix}
        finYear={invoice.finYear}
        nextSeq={invoice.nextSeq}
        terms={settings.company_terms ?? ""}
        busy={busy}
        onSave={onSave}
      />
      <CockpitSettingsForm title="Field tracking" fields={TRACKING_FIELDS} settings={settings} busy={busy} onSave={onSave} />
      <CockpitDuesForm bands={duesBands} busy={busy} onSave={onSave} />
      <CockpitGodownsForm godowns={godowns} busy={busy} onSave={onSave} />
    </div>
  );
}
