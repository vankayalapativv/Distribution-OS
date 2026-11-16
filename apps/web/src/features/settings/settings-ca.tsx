"use client";

import { useState } from "react";
import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type ActionConfig, apiRequest, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { type CompanyProfile } from "./settings-shared";
import { SectionCard } from "./settings-card";
import { EditButton, EditRow, errBorder, ReadEmpty, ReadRow, SaveError } from "./settings-field";

const FIELD = "w-full sm:w-72";

type CaFields = Pick<CompanyProfile, "caName" | "caEmail">;
type CaErrors = Partial<Record<"caEmail", string>>;

const pick = (c: CompanyProfile): CaFields => ({ caName: c.caName, caEmail: c.caEmail });
const isSet = (c: CaFields) => Boolean(c.caName.trim() || c.caEmail.trim());

/** Only the email is validated (name is free text); a filled value must be
 *  well-formed, since it's the GSTR-1 send target. */
function caErrors(f: CaFields): CaErrors {
  const e: CaErrors = {};
  if (!f.caEmail.trim()) e.caEmail = "The CA's email is required to send the GST report.";
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.caEmail.trim())) e.caEmail = "Enter a valid email.";
  return e;
}

function CaEmpty({ onAdd }: Readonly<{ onAdd: () => void }>) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-4">
      <p className="text-sm text-muted-foreground">No CA on file yet. Add your accountant so you can email them the monthly GSTR-1 in one click.</p>
      <EditButton label="Add CA details" onClick={onAdd} />
    </div>
  );
}

/** Settings → Company: the firm's Chartered Accountant — the default recipient
 *  for the GSTR-1 "email to CA" flow (Reports → GST Report). */
export function CaSection({ company, actionConfig }: Readonly<{ company: CompanyProfile; actionConfig: ActionConfig }>) {
  const [saved, setSaved] = useState<CaFields>(pick(company));
  const [form, setForm] = useState<CaFields>(pick(company));
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState<CaErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof CaFields) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const startEdit = () => { setForm(saved); setErrors({}); setSaveError(null); setEditing(true); };
  const cancel = () => { setForm(saved); setErrors({}); setSaveError(null); setEditing(false); };

  async function save() {
    const errs = caErrors(form);
    if (Object.values(errs).some(Boolean)) { setErrors(errs); return; }
    setSaving(true);
    setSaveError(null);
    const next: CaFields = { caName: form.caName.trim(), caEmail: form.caEmail.trim() };
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
    <SectionCard icon={<Calculator className="size-[18px]" />} title="Chartered Accountant" description="Where the monthly GSTR-1 report is emailed." action={action}>
      {(() => {
        if (editing) return (
          <>
            <EditRow label="CA name" description="Accountant or firm (optional).">
              <Input className={FIELD} value={form.caName} onChange={(e) => set("caName")(e.target.value)} maxLength={120} />
            </EditRow>
            <EditRow label="CA email" required description="The GSTR-1 workbook is sent here." error={errors.caEmail}>
              <Input className={cn(FIELD, errBorder(errors.caEmail))} value={form.caEmail} onChange={(e) => set("caEmail")(e.target.value)} inputMode="email" maxLength={120} />
            </EditRow>
            {saveError && <SaveError>{saveError}</SaveError>}
            <div className="mt-4 flex items-center gap-2">
              <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
              <Button size="sm" variant="ghost" onClick={cancel} disabled={saving}>Cancel</Button>
            </div>
          </>
        );
        if (isSet(saved)) return (
          <>
            <ReadRow label="CA name">{saved.caName || <ReadEmpty>Not set</ReadEmpty>}</ReadRow>
            <ReadRow label="CA email">{saved.caEmail ? <span className="font-mono">{saved.caEmail}</span> : <ReadEmpty>Not set</ReadEmpty>}</ReadRow>
          </>
        );
        return <CaEmpty onAdd={startEdit} />;
      })()}
    </SectionCard>
  );
}
