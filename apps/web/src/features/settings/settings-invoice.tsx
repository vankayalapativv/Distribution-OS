"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { withQueryClient } from "@/components/data-table/query-provider";
import { apiGet, apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import { type CompanyProfile } from "./settings-shared";
import { DEFAULT_TERMS } from "../invoices/invoice-pdf";
import { SectionCard } from "./settings-card";
import { EditButton, EditRow, errBorder, ReadRow, SaveError } from "./settings-field";

const FIELD = "w-full sm:w-72";

interface NumberConfig { prefix: string; finYear: string; nextNumber: number; padWidth: number; }

const preview = (c: NumberConfig | undefined) =>
  c ? `${c.prefix}${c.finYear}/${String(c.nextNumber).padStart(c.padWidth, "0")}` : "—";

function InvoiceSettingsInner({ company, actionConfig }: Readonly<{ company: CompanyProfile; actionConfig: ActionConfig }>) {
  const q = useQuery({ queryKey: ["invoice-number"], queryFn: () => apiGet<NumberConfig>(actionConfig, "/system-settings/invoice-number") });
  const cfg = q.data;

  const [editing, setEditing] = useState(false);
  const [prefix, setPrefix] = useState("");
  const [nextNumber, setNextNumber] = useState("");
  const [terms, setTerms] = useState(company.termsAndConditions);
  const [savedTerms, setSavedTerms] = useState(company.termsAndConditions);
  const [err, setErr] = useState<{ prefix?: string; nextNumber?: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setPrefix(cfg?.prefix ?? "SA/");
    setNextNumber(String(cfg?.nextNumber ?? 1));
    setTerms(savedTerms.trim() ? savedTerms : DEFAULT_TERMS);
    setErr(null); setSaveError(null); setEditing(true);
  };
  const cancel = () => { setErr(null); setSaveError(null); setEditing(false); };

  async function save() {
    const e: { prefix?: string; nextNumber?: string } = {};
    if (!prefix.trim()) e.prefix = "A prefix is required.";
    else if (!/^[A-Za-z0-9/-]+$/.test(prefix.trim())) e.prefix = "Letters, digits, / and - only.";
    const n = Number(nextNumber);
    if (!Number.isInteger(n) || n < 1) e.nextNumber = "Enter a whole number ≥ 1.";
    if (Object.keys(e).length) { setErr(e); return; }

    setSaving(true); setSaveError(null);
    try {
      await apiRequest(actionConfig, "PUT", "/system-settings/invoice-number", { prefix: prefix.trim(), nextNumber: n });
      await apiRequest(actionConfig, "PATCH", "/system-settings", { company: { termsAndConditions: terms } });
      setSavedTerms(terms);
      await q.refetch();
      setEditing(false);
    } catch (ex) {
      setSaveError(errorMessage(ex, "Couldn't save — check your connection and try again."));
    } finally {
      setSaving(false);
    }
  }

  const action = !editing ? <EditButton onClick={startEdit} /> : undefined;

  return (
    <SectionCard icon={<FileText className="size-[18px]" />} title="Invoice settings" description="The number series and footer terms printed on generated invoices." action={action}>
      {editing ? (
        <>
          <EditRow label="Number prefix" description="Before the financial year, e.g. SA/ → SA/2026-27/00001." error={err?.prefix}>
            <Input className={errBorder(err?.prefix) + " " + FIELD} value={prefix} onChange={(e) => setPrefix(e.target.value)} maxLength={20} />
          </EditRow>
          <EditRow label="Next number" description={`Next invoice this year (${cfg?.finYear ?? ""}).`} error={err?.nextNumber}>
            <Input className={errBorder(err?.nextNumber) + " " + FIELD} value={nextNumber} onChange={(e) => setNextNumber(e.target.value)} inputMode="numeric" />
          </EditRow>
          <EditRow label="Next invoice will be">
            <span className="font-mono text-sm text-foreground">
              {prefix || "SA/"}{cfg?.finYear ?? ""}/{String(Number(nextNumber) || 0).padStart(cfg?.padWidth ?? 5, "0")}
            </span>
          </EditRow>
          <EditRow label="Terms & Conditions" description="Printed in the invoice footer — one per line.">
            <Textarea className="w-full sm:w-96" rows={8} value={terms} onChange={(e) => setTerms(e.target.value)} maxLength={5000}
              placeholder={DEFAULT_TERMS} />
          </EditRow>
          {saveError && <SaveError>{saveError}</SaveError>}
          <div className="mt-4 flex items-center gap-2">
            <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
            <Button size="sm" variant="ghost" onClick={cancel} disabled={saving}>Cancel</Button>
          </div>
        </>
      ) : (
        <>
          <ReadRow label="Number series">{q.isLoading ? "…" : <span className="font-mono">{cfg?.prefix}{cfg?.finYear}/…</span>}</ReadRow>
          <ReadRow label="Next invoice">{q.isLoading ? "…" : <span className="font-mono">{preview(cfg)}</span>}</ReadRow>
          <ReadRow label="Terms & Conditions">
            {savedTerms.trim()
              ? <span className="whitespace-pre-line text-[13px] leading-relaxed">{savedTerms}</span>
              : <span className="whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground">{DEFAULT_TERMS}<span className="mt-1 block text-xs italic">Default — edit to customise.</span></span>}
          </ReadRow>
        </>
      )}
    </SectionCard>
  );
}

export const InvoiceSettingsSection = withQueryClient(InvoiceSettingsInner);
