"use client";

import { useState } from "react";
import { Building2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type ActionConfig, apiRequest, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { INDIAN_STATES } from "@/lib/indian-states";
import { SearchSelect } from "@/features/orders/search-select";
import { type CompanyProfile, PanelHeader } from "./settings-shared";
import { SectionCard } from "./settings-card";
import { EditRow, errBorder, SaveError } from "./settings-field";
import { BankSection } from "./settings-bank";
import { InvoiceSettingsSection } from "./settings-invoice";
import { GodownsSection } from "./settings-godowns";

const FIELD = "w-full sm:w-72";
const MONO = `${FIELD} font-mono uppercase tracking-wide`;
// rgb (not oklch) so it renders on pre-2023 browsers (inline styles bypass the
// PostCSS oklch fallback).
const HERO_BG = "linear-gradient(135deg, #2e62c9, #5040a8)";

type IdErrors = Partial<Record<"legalName" | "gstin" | "addressLine1" | "city" | "state" | "pincode", string>>;

/** Per-field validation for the identity form (inline errors). Every field is
 *  mandatory. */
function identityErrors(f: CompanyProfile): IdErrors {
  const e: IdErrors = {};
  if (!f.legalName.trim()) e.legalName = "Legal name is required.";
  if (!f.gstin.trim()) e.gstin = "GSTIN is required.";
  else if (!/^[0-9A-Z]{15}$/.test(f.gstin.trim().toUpperCase())) e.gstin = "GSTIN must be 15 characters.";
  if (!f.addressLine1.trim()) e.addressLine1 = "Address line 1 is required.";
  if (!f.city.trim()) e.city = "City is required.";
  if (!f.state.trim()) e.state = "State is required.";
  if (!/^\d{6}$/.test(f.pincode.trim())) e.pincode = "Enter a 6-digit pincode.";
  return e;
}

/** The gradient identity banner shown when the section is in read mode. */
function IdentityHero({ company, onEdit }: Readonly<{ company: CompanyProfile; onEdit: () => void }>) {
  const addr = [company.addressLine1, company.addressLine2, [company.city, company.state, company.pincode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return (
    <div className="relative overflow-hidden rounded-2xl p-6 text-white shadow-lg" style={{ background: HERO_BG }}>
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(120% 120% at 100% 0%, rgba(255,255,255,0.16), transparent 55%)" }} />
      <button type="button" onClick={onEdit}
        className="absolute right-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/30">
        <Pencil className="size-3.5" /> Edit
      </button>
      <div className="relative pr-16 text-xl font-bold tracking-tight">{company.legalName || "Your company"}</div>
      <div className="relative mt-2.5 flex flex-col gap-1.5 text-[12.5px] text-white/90">
        {company.gstin && (
          <span className="inline-flex w-fit items-center rounded-md bg-white/20 px-2 py-1 font-mono text-[11.5px] font-semibold tracking-wide">GSTIN {company.gstin}</span>
        )}
        {addr && <span className="leading-relaxed">{addr}</span>}
        {(company.phone || company.email) && (
          <span className="leading-relaxed">
            {[company.phone && `Tel ${company.phone}`, company.email].filter(Boolean).join("  ·  ")}
          </span>
        )}
      </div>
    </div>
  );
}

function IdentitySection({ company, actionConfig }: Readonly<{ company: CompanyProfile; actionConfig: ActionConfig }>) {
  const [saved, setSaved] = useState<CompanyProfile>(company);
  const [form, setForm] = useState<CompanyProfile>(company);
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState<IdErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof CompanyProfile) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const startEdit = () => { setForm(saved); setErrors({}); setSaveError(null); setEditing(true); };
  const cancel = () => { setForm(saved); setErrors({}); setSaveError(null); setEditing(false); };

  async function save() {
    const errs = identityErrors(form);
    if (Object.values(errs).some(Boolean)) { setErrors(errs); return; }
    setSaving(true);
    setSaveError(null);
    const next: CompanyProfile = {
      ...saved,
      legalName: form.legalName.trim(), gstin: form.gstin.trim().toUpperCase(),
      addressLine1: form.addressLine1.trim(), addressLine2: form.addressLine2.trim(),
      city: form.city.trim(), state: form.state.trim(), pincode: form.pincode.trim(),
      phone: form.phone.trim(), email: form.email.trim(),
    };
    try {
      await apiRequest(actionConfig, "PATCH", "/system-settings", {
        company: {
          legalName: next.legalName, gstin: next.gstin, addressLine1: next.addressLine1,
          addressLine2: next.addressLine2, city: next.city, state: next.state, pincode: next.pincode,
          phone: next.phone, email: next.email,
        },
      });
      setSaved(next);
      setEditing(false);
    } catch (err) {
      setSaveError(errorMessage(err, "Couldn't save — check your connection and try again."));
    } finally {
      setSaving(false);
    }
  }

  if (!editing) return <IdentityHero company={saved} onEdit={startEdit} />;

  return (
    <SectionCard icon={<Building2 className="size-[18px]" />} title="Business identity" description="Legal and tax details printed on invoices.">
      <EditRow label="Legal name" required error={errors.legalName}>
        <Input className={cn(FIELD, errBorder(errors.legalName))} value={form.legalName} onChange={(e) => set("legalName")(e.target.value)} />
      </EditRow>
      <EditRow label="GSTIN" required description="15-character GST identification number." error={errors.gstin}>
        <Input className={cn(MONO, errBorder(errors.gstin))} value={form.gstin} onChange={(e) => set("gstin")(e.target.value)} maxLength={15} />
      </EditRow>
      <EditRow label="Phone" description="Printed in the invoice header (Tel : …).">
        <Input className={FIELD} value={form.phone} onChange={(e) => set("phone")(e.target.value)} inputMode="tel" maxLength={40} />
      </EditRow>
      <EditRow label="Email" description="Printed in the invoice header (email : …).">
        <Input className={FIELD} value={form.email} onChange={(e) => set("email")(e.target.value)} inputMode="email" maxLength={120} />
      </EditRow>
      <EditRow label="Address line 1" required description="Street / building — printed on report headers." error={errors.addressLine1}>
        <Input className={cn(FIELD, errBorder(errors.addressLine1))} value={form.addressLine1} onChange={(e) => set("addressLine1")(e.target.value)} />
      </EditRow>
      <EditRow label="Address line 2" description="Area or landmark.">
        <Input className={FIELD} value={form.addressLine2} onChange={(e) => set("addressLine2")(e.target.value)} />
      </EditRow>
      <EditRow label="City" required error={errors.city}>
        <Input className={cn(FIELD, errBorder(errors.city))} value={form.city} onChange={(e) => set("city")(e.target.value)} />
      </EditRow>
      <EditRow label="State" required error={errors.state}>
        <div className={FIELD}>
          <SearchSelect
            items={INDIAN_STATES.map((s) => ({ id: s, name: s }))}
            valueKey={form.state} getKey={(x) => x.id} getLabel={(x) => x.name} onSelect={(v) => set("state")(v)}
            placeholder="" searchPlaceholder="Search state…" emptyText="No state found"
            contentClassName="w-72 p-0" triggerClassName={errBorder(errors.state)}
          />
        </div>
      </EditRow>
      <EditRow label="Pincode" required description="6-digit postal code." error={errors.pincode}>
        <Input className={cn(FIELD, errBorder(errors.pincode))} value={form.pincode} onChange={(e) => set("pincode")(e.target.value)} inputMode="numeric" maxLength={6} />
      </EditRow>

      {saveError && <SaveError>{saveError}</SaveError>}
      <div className="mt-4 flex items-center gap-2">
        <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        <Button size="sm" variant="ghost" onClick={cancel} disabled={saving}>Cancel</Button>
      </div>
    </SectionCard>
  );
}

export function CompanyPanel({ company, actionConfig }: Readonly<{ company: CompanyProfile; actionConfig: ActionConfig }>) {
  return (
    <>
      <PanelHeader title="Company" subtitle="Your business identity, how you get paid, and where you keep stock." />
      <div className="mt-4 flex flex-col gap-4">
        <IdentitySection company={company} actionConfig={actionConfig} />
        <BankSection company={company} actionConfig={actionConfig} />
        <InvoiceSettingsSection company={company} actionConfig={actionConfig} />
        <GodownsSection actionConfig={actionConfig} />
      </div>
    </>
  );
}
