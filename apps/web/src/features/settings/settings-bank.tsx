"use client";

import { useState } from "react";
import { Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type ActionConfig, apiRequest, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { type CompanyProfile } from "./settings-shared";
import { SectionCard } from "./settings-card";
import { EditButton, EditRow, errBorder, ReadEmpty, ReadRow, SaveError } from "./settings-field";

const FIELD = "w-full sm:w-72";
const MONO = `${FIELD} font-mono`;

type BankFields = Pick<CompanyProfile, "bankAccountName" | "bankAccountNumber" | "bankIfsc" | "upiId">;
type BankErrors = Partial<Record<"bankAccountName" | "bankAccountNumber" | "bankIfsc" | "upiId", string>>;

const pick = (c: CompanyProfile): BankFields => ({
  bankAccountName: c.bankAccountName, bankAccountNumber: c.bankAccountNumber, bankIfsc: c.bankIfsc, upiId: c.upiId,
});
const isSet = (b: BankFields) => Boolean(b.bankAccountName.trim() || b.bankAccountNumber.trim() || b.bankIfsc.trim() || b.upiId.trim());
const mask = (acct: string) => (acct ? `•••• •••• ${acct.slice(-4)}` : "");

/** Per-field validation (inline errors). Every field is mandatory when saving
 *  payment details, and a filled value must be well-formed. */
function bankErrors(f: BankFields): BankErrors {
  const e: BankErrors = {};
  if (!f.bankAccountName.trim()) e.bankAccountName = "Account name is required.";
  if (!f.bankAccountNumber.trim()) e.bankAccountNumber = "Account number is required.";
  else if (!/^\d{5,20}$/.test(f.bankAccountNumber.trim())) e.bankAccountNumber = "Account number must be 5–20 digits.";
  if (!f.bankIfsc.trim()) e.bankIfsc = "IFSC is required.";
  else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(f.bankIfsc.trim().toUpperCase())) e.bankIfsc = "IFSC must be 11 characters (e.g. HDFC0001234).";
  if (!f.upiId.trim()) e.upiId = "UPI ID is required.";
  else if (!/^[\w.\-]{2,}@[\w.\-]{2,}$/.test(f.upiId.trim())) e.upiId = "Enter a valid UPI ID (e.g. name@bank).";
  return e;
}

function BankEditForm({ form, set, errors, saving, saveError, onSave, onCancel }: Readonly<{
  form: BankFields; set: (k: keyof BankFields) => (v: string) => void; errors: BankErrors;
  saving: boolean; saveError: string | null; onSave: () => void; onCancel: () => void;
}>) {
  return (
    <>
      <EditRow label="Account name" required error={errors.bankAccountName}>
        <Input className={cn(FIELD, errBorder(errors.bankAccountName))} value={form.bankAccountName} onChange={(e) => set("bankAccountName")(e.target.value)} />
      </EditRow>
      <EditRow label="Account number" required error={errors.bankAccountNumber}>
        <Input className={cn(FIELD, errBorder(errors.bankAccountNumber))} value={form.bankAccountNumber} onChange={(e) => set("bankAccountNumber")(e.target.value)} inputMode="numeric" maxLength={20} />
      </EditRow>
      <EditRow label="IFSC code" required description="11-character branch code." error={errors.bankIfsc}>
        <Input className={cn(MONO, "uppercase tracking-wide", errBorder(errors.bankIfsc))} value={form.bankIfsc} onChange={(e) => set("bankIfsc")(e.target.value)} maxLength={11} />
      </EditRow>
      <EditRow label="UPI ID" required description="For UPI / QR collection." error={errors.upiId}>
        <Input className={cn(MONO, errBorder(errors.upiId))} value={form.upiId} onChange={(e) => set("upiId")(e.target.value)} maxLength={100} />
      </EditRow>
      {saveError && <SaveError>{saveError}</SaveError>}
      <div className="mt-4 flex items-center gap-2">
        <Button size="sm" onClick={onSave} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
      </div>
    </>
  );
}

function BankReadView({ saved }: Readonly<{ saved: BankFields }>) {
  return (
    <>
      <ReadRow label="Account name">{saved.bankAccountName || <ReadEmpty>Not set</ReadEmpty>}</ReadRow>
      <ReadRow label="Account number">{saved.bankAccountNumber ? <span className="font-mono">{mask(saved.bankAccountNumber)}</span> : <ReadEmpty>Not set</ReadEmpty>}</ReadRow>
      <ReadRow label="IFSC code">{saved.bankIfsc ? <span className="font-mono">{saved.bankIfsc}</span> : <ReadEmpty>Not set</ReadEmpty>}</ReadRow>
      <ReadRow label="UPI ID">{saved.upiId ? <span className="font-mono">{saved.upiId}</span> : <ReadEmpty>Not set</ReadEmpty>}</ReadRow>
    </>
  );
}

function BankEmpty({ onAdd }: Readonly<{ onAdd: () => void }>) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-4">
      <p className="text-sm text-muted-foreground">No payment details yet. Add a bank account & UPI so they print on your invoices.</p>
      <EditButton label="Add payment details" onClick={onAdd} />
    </div>
  );
}

/** Settings → Company: the business's own bank account + UPI, printed on the
 *  generated invoice so the buyer knows where to pay. Read-only until Edit. */
export function BankSection({ company, actionConfig }: Readonly<{ company: CompanyProfile; actionConfig: ActionConfig }>) {
  const [saved, setSaved] = useState<BankFields>(pick(company));
  const [form, setForm] = useState<BankFields>(pick(company));
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState<BankErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof BankFields) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const startEdit = () => { setForm(saved); setErrors({}); setSaveError(null); setEditing(true); };
  const cancel = () => { setForm(saved); setErrors({}); setSaveError(null); setEditing(false); };

  async function save() {
    const errs = bankErrors(form);
    if (Object.values(errs).some(Boolean)) { setErrors(errs); return; }
    setSaving(true);
    setSaveError(null);
    const next: BankFields = {
      bankAccountName: form.bankAccountName.trim(), bankAccountNumber: form.bankAccountNumber.trim(),
      bankIfsc: form.bankIfsc.trim().toUpperCase(), upiId: form.upiId.trim(),
    };
    try {
      await apiRequest(actionConfig, "PATCH", "/system-settings", { company: next });
      setSaved(next);
      setEditing(false);
    } catch (err) {
      setSaveError(errorMessage(err, "Couldn't save — check your connection and try again."));
    } finally {
      setSaving(false);
    }
  }

  const action = !editing && isSet(saved) ? <EditButton onClick={startEdit} /> : undefined;

  return (
    <SectionCard icon={<Landmark className="size-[18px]" />} title="Payment details" description="Shown on your invoices so customers know where to pay." action={action}>
      {(() => { if (editing) return (
        <BankEditForm form={form} set={set} errors={errors} saving={saving} saveError={saveError} onSave={save} onCancel={cancel} />
      ); if (isSet(saved)) return (
        <BankReadView saved={saved} />
      ); return (
        <BankEmpty onAdd={startEdit} />
      ); })()}
    </SectionCard>
  );
}
