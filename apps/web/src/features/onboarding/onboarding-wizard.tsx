"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const DEFAULT_TERMS = `1. Goods once sold will not be taken back.
2. Interest @18% p.a. charged on overdue bills.
3. Subject to local jurisdiction.
4. Our risk ceases once goods leave our premises.`;

type Godown = { name: string; city: string; state: string; stateCode: string };
type DuesBand = { fromDays: string; toDays: string; label: string };
interface Data {
  admin: { name: string; designation: string };
  company: { legalName: string; gstin: string; tradeName: string; contactPhone: string; contactEmail: string };
  address: { line1: string; line2: string; city: string; state: string; pincode: string };
  bank: { bankName: string; accountName: string; accountNumber: string; ifsc: string; upiId: string };
  invoice: { prefix: string; finYear: string; startSeq: string; terms: string };
  godowns: Godown[];
  tracking: { se: string; logistics: string };
  duesBands: DuesBand[];
}

const EMPTY: Data = {
  admin: { name: "", designation: "" },
  company: { legalName: "", gstin: "", tradeName: "", contactPhone: "", contactEmail: "" },
  address: { line1: "", line2: "", city: "", state: "", pincode: "" },
  bank: { bankName: "", accountName: "", accountNumber: "", ifsc: "", upiId: "" },
  invoice: { prefix: "", finYear: "2026-27", startSeq: "1", terms: DEFAULT_TERMS },
  godowns: [{ name: "", city: "", state: "", stateCode: "" }],
  tracking: { se: "20:00", logistics: "22:00" },
  duesBands: [
    { fromDays: "0", toDays: "30", label: "0–30 days" },
    { fromDays: "31", toDays: "45", label: "31–45 days" },
    { fromDays: "46", toDays: "60", label: "46–60 days" },
    { fromDays: "61", toDays: "", label: "61+ days" },
  ],
};

const STEPS = [
  "Administrator", "Company identity", "Registered address", "Banking & payment",
  "Invoice setup", "Godowns", "Field tracking", "Collection dues", "Review & submit",
];

function Req() {
  return <span className="text-destructive"> *</span>;
}
function Field({ label, children, hint }: { label: React.ReactNode; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {hint ? <span className="text-[11.5px] text-muted-foreground">{hint}</span> : null}
    </div>
  );
}
function Mand({ children }: { children?: React.ReactNode }) {
  return (
    <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-[11.5px] text-muted-foreground">
      {children ?? <><b className="font-semibold text-foreground">All fields required</b> — nothing here is optional.</>}
    </div>
  );
}

export function OnboardingWizard({ initial, rejectedReason }: { initial: Partial<Data> & { currentStep?: number } | null; rejectedReason?: string | null }) {
  const router = useRouter();
  const start = { ...EMPTY, ...(initial ?? {}) } as Data;
  const [data, setData] = useState<Data>(start);
  const [step, setStep] = useState<number>(Math.min(initial?.currentStep ?? 0, STEPS.length - 1));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const firstRender = useRef(true);

  // Debounced autosave of the draft.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const id = setTimeout(async () => {
      try {
        await fetch("/api/onboarding", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: data, currentStep: step }),
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 1600);
      } catch { /* ignore transient autosave errors */ }
    }, 700);
    return () => clearTimeout(id);
  }, [data, step]);

  const upd = useCallback(<K extends keyof Data>(key: K, patch: Partial<Data[K]>) => {
    setData((d) => ({ ...d, [key]: { ...(d[key] as object), ...patch } }));
  }, []);

  function validate(): string | null {
    const need: Array<[string, string]> = [
      [data.admin.name, "Administrator name"], [data.admin.designation, "Designation"],
      [data.company.legalName, "Legal company name"], [data.company.gstin, "GSTIN"],
      [data.company.tradeName, "Trade name"], [data.company.contactPhone, "Business phone"],
      [data.company.contactEmail, "Business email"], [data.address.line1, "Address line 1"],
      [data.address.city, "City"], [data.address.state, "State"], [data.address.pincode, "Pincode"],
      [data.bank.bankName, "Bank name"], [data.bank.accountName, "Account holder name"],
      [data.bank.accountNumber, "Account number"], [data.bank.ifsc, "IFSC code"], [data.bank.upiId, "UPI ID"],
      [data.invoice.prefix, "Invoice prefix"], [data.invoice.finYear, "Financial year"], [data.invoice.terms, "Terms & conditions"],
    ];
    for (const [v, name] of need) if (!v.trim()) return `${name} is required.`;
    if (!data.invoice.startSeq.trim() || Number.isNaN(Number(data.invoice.startSeq))) return "Starting invoice number is required.";
    if (data.godowns.length < 1) return "Add at least one godown.";
    for (const g of data.godowns) if (!g.name.trim() || !g.state.trim() || !g.stateCode.trim()) return "Every godown needs a name, state and GST state code.";
    if (data.duesBands.length < 1) return "Add at least one dues band.";
    for (const b of data.duesBands) if (!b.label.trim() || b.fromDays.trim() === "") return "Every dues band needs a from-day and a label.";
    return null;
  }

  function toPayload() {
    return {
      admin: data.admin,
      company: data.company,
      address: { ...data.address, line2: data.address.line2 || null },
      bank: data.bank,
      invoice: { ...data.invoice, startSeq: Number(data.invoice.startSeq) },
      godowns: data.godowns,
      tracking: {
        seAutoStopHour: Number(data.tracking.se.split(":")[0] ?? 20),
        logisticsAutoStopHour: Number(data.tracking.logistics.split(":")[0] ?? 22),
      },
      duesBands: data.duesBands.map((b) => ({
        fromDays: Number(b.fromDays), toDays: b.toDays.trim() === "" ? null : Number(b.toDays), label: b.label,
      })),
    };
  }

  async function submit() {
    const v = validate();
    if (v) { setError(v); return; }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: toPayload() }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } | string };
      if (!res.ok) {
        const msg = typeof body.error === "string" ? body.error : body.error?.message;
        setError(msg ?? "Could not submit. Check your details and try again.");
        setSubmitting(false);
        return;
      }
      router.refresh(); // page re-renders into the pending screen
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  const next = () => (step === STEPS.length - 1 ? submit() : setStep((s) => Math.min(STEPS.length - 1, s + 1)));
  const back = () => setStep((s) => Math.max(0, s - 1));
  const pct = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-card/90 px-5 py-3 backdrop-blur">
        <span className="text-[15px] font-extrabold tracking-tight">Distribution&nbsp;OS</span>
        <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Onboarding</span>
      </header>

      <main className="mx-auto max-w-[1080px] px-4 py-7">
        <div className="grid items-start gap-6 lg:grid-cols-[276px_1fr]">
          {/* Rail */}
          <div className="lg:sticky lg:top-[84px]">
            <h2 className="text-[18px] font-extrabold tracking-tight">Set up your company</h2>
            <p className="mb-4 mt-1 text-[12.5px] text-muted-foreground">
              Every field is required. Progress saves automatically.
            </p>
            <div className="mb-[18px] h-[6px] overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} />
            </div>
            <ul className="hidden list-none flex-col gap-0.5 p-0 lg:flex">
              {STEPS.map((name, i) => {
                const current = i === step, done = i < step;
                return (
                  <li key={name}>
                    <button
                      onClick={() => setStep(i)}
                      className={`flex w-full items-center gap-3 rounded-[9px] px-2.5 py-2 text-left text-[13px] ${
                        current ? "bg-primary/10 font-semibold text-foreground" : done ? "text-foreground hover:bg-secondary" : "text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      <span className={`grid h-[23px] w-[23px] flex-none place-items-center rounded-full text-[11.5px] font-bold ${
                        done ? "bg-primary text-primary-foreground" : current ? "border-[1.5px] border-primary text-primary" : "border-[1.5px] border-border bg-card"
                      }`}>{i + 1}</span>
                      {name}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Panel */}
          <div className="rounded-[10px] border border-border bg-card p-6 shadow-sm sm:p-7">
            <div className="mb-3 text-[13px] text-muted-foreground lg:hidden">Step {step + 1} of {STEPS.length} · {STEPS[step]}</div>
            {rejectedReason ? (
              <div className="mb-5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
                Your previous submission was returned: {rejectedReason}. Update your details and resubmit.
              </div>
            ) : null}
            {error ? (
              <div className="mb-5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{error}</div>
            ) : null}

            {step === 0 && (
              <Step n={1} title="Administrator" lead="You'll be the first Super Admin for this company.">
                <Mand />
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <Field label={<>Full name<Req /></>}><Input value={data.admin.name} onChange={(e) => upd("admin", { name: e.target.value })} /></Field>
                  <Field label={<>Designation<Req /></>}><Input value={data.admin.designation} onChange={(e) => upd("admin", { designation: e.target.value })} placeholder="e.g. Director" /></Field>
                </div>
              </Step>
            )}

            {step === 1 && (
              <Step n={2} title="Company identity" lead="As it should appear on your GST tax invoices.">
                <Mand />
                <Field label={<>Legal company name<Req /></>}><Input value={data.company.legalName} onChange={(e) => upd("company", { legalName: e.target.value })} /></Field>
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <Field label={<>GSTIN<Req /></>} hint="15-character GST number, e.g. 36AAAAA0000A1Z5"><Input className="font-mono" value={data.company.gstin} onChange={(e) => upd("company", { gstin: e.target.value })} /></Field>
                  <Field label={<>Trade / display name<Req /></>}><Input value={data.company.tradeName} onChange={(e) => upd("company", { tradeName: e.target.value })} /></Field>
                </div>
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <Field label={<>Business phone<Req /></>}><Input value={data.company.contactPhone} onChange={(e) => upd("company", { contactPhone: e.target.value })} /></Field>
                  <Field label={<>Business email<Req /></>}><Input value={data.company.contactEmail} onChange={(e) => upd("company", { contactEmail: e.target.value })} /></Field>
                </div>
              </Step>
            )}

            {step === 2 && (
              <Step n={3} title="Registered address" lead="Your principal place of business.">
                <Mand />
                <Field label={<>Address line 1<Req /></>}><Input value={data.address.line1} onChange={(e) => upd("address", { line1: e.target.value })} /></Field>
                <Field label="Address line 2"><Input value={data.address.line2} onChange={(e) => upd("address", { line2: e.target.value })} /></Field>
                <div className="grid gap-3.5 sm:grid-cols-3">
                  <Field label={<>City<Req /></>}><Input value={data.address.city} onChange={(e) => upd("address", { city: e.target.value })} /></Field>
                  <Field label={<>State<Req /></>}><Input value={data.address.state} onChange={(e) => upd("address", { state: e.target.value })} /></Field>
                  <Field label={<>Pincode<Req /></>}><Input className="font-mono" value={data.address.pincode} onChange={(e) => upd("address", { pincode: e.target.value })} /></Field>
                </div>
              </Step>
            )}

            {step === 3 && (
              <Step n={4} title="Banking & payment" lead="Printed on your invoices so customers can pay you.">
                <Mand />
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <Field label={<>Bank name<Req /></>}><Input value={data.bank.bankName} onChange={(e) => upd("bank", { bankName: e.target.value })} /></Field>
                  <Field label={<>Account holder name<Req /></>}><Input value={data.bank.accountName} onChange={(e) => upd("bank", { accountName: e.target.value })} /></Field>
                </div>
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <Field label={<>Account number<Req /></>}><Input className="font-mono" value={data.bank.accountNumber} onChange={(e) => upd("bank", { accountNumber: e.target.value })} /></Field>
                  <Field label={<>IFSC code<Req /></>}><Input className="font-mono" value={data.bank.ifsc} onChange={(e) => upd("bank", { ifsc: e.target.value })} /></Field>
                </div>
                <Field label={<>UPI ID<Req /></>} hint="Shown with a QR code on every invoice."><Input className="font-mono" value={data.bank.upiId} onChange={(e) => upd("bank", { upiId: e.target.value })} /></Field>
              </Step>
            )}

            {step === 4 && (
              <Step n={5} title="Invoice setup" lead="Your invoice numbering and the terms printed on each one.">
                <Mand />
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <Field label={<>Invoice prefix<Req /></>} hint="e.g. ACM/2026-27/"><Input className="font-mono" value={data.invoice.prefix} onChange={(e) => upd("invoice", { prefix: e.target.value })} /></Field>
                  <Field label={<>Starting number<Req /></>}><Input className="font-mono" value={data.invoice.startSeq} onChange={(e) => upd("invoice", { startSeq: e.target.value })} /></Field>
                </div>
                <Field label={<>Terms & conditions<Req /></>} hint="Pre-filled with a standard default — edit to match your business.">
                  <Textarea className="min-h-[110px] font-mono text-[13px]" value={data.invoice.terms} onChange={(e) => upd("invoice", { terms: e.target.value })} />
                </Field>
              </Step>
            )}

            {step === 5 && (
              <Step n={6} title="Godowns" lead="At least one stock location is required.">
                <Mand />
                {data.godowns.map((g, i) => (
                  <div key={i} className="mb-3 rounded-[7px] border border-border bg-secondary p-4 pb-1">
                    <div className="mb-2.5 flex items-center justify-between">
                      <b className="text-[12.5px]">Godown {i + 1}{i === 0 ? " · Primary" : ""}</b>
                      {i > 0 ? <button onClick={() => setData((d) => ({ ...d, godowns: d.godowns.filter((_, j) => j !== i) }))} className="rounded px-1.5 py-0.5 text-[12px] font-semibold text-destructive hover:bg-destructive/10">Remove</button> : null}
                    </div>
                    <div className="grid gap-3.5 sm:grid-cols-2">
                      <Field label={<>Name<Req /></>}><Input value={g.name} onChange={(e) => setGodown(i, { name: e.target.value })} /></Field>
                      <Field label="City"><Input value={g.city} onChange={(e) => setGodown(i, { city: e.target.value })} /></Field>
                      <Field label={<>State<Req /></>}><Input value={g.state} onChange={(e) => setGodown(i, { state: e.target.value })} /></Field>
                      <Field label={<>GST state code<Req /></>}><Input className="font-mono" value={g.stateCode} onChange={(e) => setGodown(i, { stateCode: e.target.value })} /></Field>
                    </div>
                  </div>
                ))}
                <button onClick={() => setData((d) => ({ ...d, godowns: [...d.godowns, { name: "", city: "", state: "", stateCode: "" }] }))} className="w-full rounded-[7px] border border-dashed border-border bg-transparent p-2.5 text-[13px] font-semibold text-primary hover:bg-primary/10">+ Add another godown</button>
              </Step>
            )}

            {step === 6 && (
              <Step n={7} title="Field tracking" lead="When the day's GPS tracking auto-stops for each team.">
                <Mand />
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <Field label={<>Sales Executive auto-stop<Req /></>} hint="Field day typically ends by evening."><Input type="time" value={data.tracking.se} onChange={(e) => upd("tracking", { se: e.target.value })} /></Field>
                  <Field label={<>Logistics auto-stop<Req /></>} hint="Delivery runs often finish later."><Input type="time" value={data.tracking.logistics} onChange={(e) => upd("tracking", { logistics: e.target.value })} /></Field>
                </div>
              </Step>
            )}

            {step === 7 && (
              <Step n={8} title="Collection dues bands" lead="How overdue money is aged. A customer sits in one band by how long their oldest overdue invoice has been past due.">
                <Mand><b className="font-semibold text-foreground">Required</b> — at least one band; the last is open-ended.</Mand>
                {data.duesBands.map((b, i) => (
                  <div key={i} className="mb-2.5 grid grid-cols-[1fr_1fr] items-end gap-2.5 sm:grid-cols-[90px_90px_1fr_auto]">
                    <Field label="From"><Input className="font-mono" value={b.fromDays} onChange={(e) => setBand(i, { fromDays: e.target.value })} /></Field>
                    <Field label="To"><Input className="font-mono" value={b.toDays} onChange={(e) => setBand(i, { toDays: e.target.value })} placeholder="∞" /></Field>
                    <Field label="Label"><Input value={b.label} onChange={(e) => setBand(i, { label: e.target.value })} /></Field>
                    <button onClick={() => data.duesBands.length > 1 && setData((d) => ({ ...d, duesBands: d.duesBands.filter((_, j) => j !== i) }))} className="rounded px-1.5 py-2 text-[12px] font-semibold text-destructive hover:bg-destructive/10">Remove</button>
                  </div>
                ))}
                <button onClick={() => setData((d) => ({ ...d, duesBands: [...d.duesBands, { fromDays: "", toDays: "", label: "" }] }))} className="w-full rounded-[7px] border border-dashed border-border bg-transparent p-2.5 text-[13px] font-semibold text-primary hover:bg-primary/10">+ Add band</button>
              </Step>
            )}

            {step === 8 && (
              <Step n={9} title="Review & submit" lead="Check everything, then submit for approval. You can't use the app until it's approved.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Rev title="Administrator" to={0} setStep={setStep} rows={[["Name", data.admin.name], ["Role", data.admin.designation]]} />
                  <Rev title="Company" to={1} setStep={setStep} rows={[["Legal", data.company.legalName], ["GSTIN", data.company.gstin]]} />
                  <Rev title="Address" to={2} setStep={setStep} rows={[["City", data.address.city], ["State", `${data.address.state} · ${data.address.pincode}`]]} />
                  <Rev title="Banking" to={3} setStep={setStep} rows={[["Bank", data.bank.bankName], ["UPI", data.bank.upiId]]} />
                  <Rev title="Invoicing" to={4} setStep={setStep} rows={[["Series", `${data.invoice.prefix}${data.invoice.startSeq}`], ["Terms", `${data.invoice.terms.split("\n").filter(Boolean).length} clauses`]]} />
                  <Rev title="Operations" to={5} setStep={setStep} rows={[["Godowns", String(data.godowns.length)], ["Dues bands", String(data.duesBands.length)]]} />
                </div>
              </Step>
            )}

            <div className="mt-6 flex items-center gap-3 border-t border-border pt-[18px]">
              {step > 0 ? <Button variant="outline" onClick={back}>Back</Button> : null}
              <span className={`text-[12px] font-semibold text-[oklch(0.62_0.15_150)] transition-opacity ${saved ? "opacity-100" : "opacity-0"}`}>Saved</span>
              <span className="flex-1" />
              <Button onClick={next} disabled={submitting}>
                {step === STEPS.length - 1 ? (submitting ? "Submitting…" : "Submit for approval") : "Continue"}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );

  function setGodown(i: number, patch: Partial<Godown>) {
    setData((d) => ({ ...d, godowns: d.godowns.map((g, j) => (j === i ? { ...g, ...patch } : g)) }));
  }
  function setBand(i: number, patch: Partial<DuesBand>) {
    setData((d) => ({ ...d, duesBands: d.duesBands.map((b, j) => (j === i ? { ...b, ...patch } : b)) }));
  }
}

function Step({ n, title, lead, children }: { n: number; title: string; lead: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">Step {n} of 8</div>
      <h3 className="mb-0.5 mt-1 text-[19px] font-bold tracking-tight">{title}</h3>
      <p className="mb-5 text-[13px] text-muted-foreground">{lead}</p>
      <div className="flex flex-col gap-3.5">{children}</div>
    </div>
  );
}
function Rev({ title, to, setStep, rows }: { title: string; to: number; setStep: (n: number) => void; rows: Array<[string, string]> }) {
  return (
    <div className="rounded-[7px] border border-border bg-secondary p-[13px_15px]">
      <div className="mb-2 flex justify-between text-[12px] font-bold uppercase tracking-[0.04em] text-muted-foreground">
        {title}
        <button onClick={() => setStep(to)} className="text-[12px] font-semibold normal-case tracking-normal text-primary">Edit</button>
      </div>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1 text-[12.5px]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="m-0 truncate text-right font-medium">{v || "—"}</dd></div>
        ))}
      </dl>
    </div>
  );
}
