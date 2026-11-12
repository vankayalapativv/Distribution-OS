"use client";

import { cloneElement, isValidElement, useCallback, useEffect, useId, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
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
const LAST = STEPS.length - 1;

// ── Field formats (light client-side checks; the server validates authoritatively).
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/i;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/i;
const PIN_RE = /^[1-9][0-9]{5}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[0-9][0-9\s-]{6,14}$/;
const UPI_RE = /^[\w.-]{2,}@[a-zA-Z]{2,}$/;
const ACCT_RE = /^[0-9]{6,18}$/;
const CODE_RE = /^[0-9]{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

type Errors = Record<string, string>;

/** Per-step field errors, keyed by dot-path (e.g. "company.gstin", "godowns.0.name"). */
function validateStep(i: number, d: Data): Errors {
  const e: Errors = {};
  const req = (empty: boolean, key: string, msg: string) => {
    if (empty) e[key] = msg;
  };
  switch (i) {
    case 0:
      req(!d.admin.name.trim(), "admin.name", "Enter the administrator’s name.");
      req(!d.admin.designation.trim(), "admin.designation", "Enter a designation.");
      break;
    case 1:
      req(!d.company.legalName.trim(), "company.legalName", "Enter the legal company name.");
      // GSTIN is optional — but if provided it must be a valid 15-character GSTIN.
      if (d.company.gstin.trim() && !GSTIN_RE.test(d.company.gstin.trim())) e["company.gstin"] = "Enter a valid 15-character GSTIN.";
      req(!d.company.tradeName.trim(), "company.tradeName", "Enter a trade / display name.");
      if (!d.company.contactPhone.trim()) e["company.contactPhone"] = "Enter a business phone.";
      else if (!PHONE_RE.test(d.company.contactPhone.trim())) e["company.contactPhone"] = "Enter a valid phone number.";
      if (!d.company.contactEmail.trim()) e["company.contactEmail"] = "Enter a business email.";
      else if (!EMAIL_RE.test(d.company.contactEmail.trim())) e["company.contactEmail"] = "Enter a valid email address.";
      break;
    case 2:
      req(!d.address.line1.trim(), "address.line1", "Enter address line 1.");
      req(!d.address.city.trim(), "address.city", "Enter the city.");
      req(!d.address.state.trim(), "address.state", "Enter the state.");
      if (!d.address.pincode.trim()) e["address.pincode"] = "Enter the pincode.";
      else if (!PIN_RE.test(d.address.pincode.trim())) e["address.pincode"] = "Enter a valid 6-digit pincode.";
      break;
    case 3:
      req(!d.bank.bankName.trim(), "bank.bankName", "Enter the bank name.");
      req(!d.bank.accountName.trim(), "bank.accountName", "Enter the account holder name.");
      if (!d.bank.accountNumber.trim()) e["bank.accountNumber"] = "Enter the account number.";
      else if (!ACCT_RE.test(d.bank.accountNumber.trim())) e["bank.accountNumber"] = "Enter a valid account number.";
      if (!d.bank.ifsc.trim()) e["bank.ifsc"] = "Enter the IFSC code.";
      else if (!IFSC_RE.test(d.bank.ifsc.trim())) e["bank.ifsc"] = "Enter a valid 11-character IFSC.";
      if (!d.bank.upiId.trim()) e["bank.upiId"] = "Enter the UPI ID.";
      else if (!UPI_RE.test(d.bank.upiId.trim())) e["bank.upiId"] = "Enter a valid UPI ID (name@bank).";
      break;
    case 4:
      req(!d.invoice.prefix.trim(), "invoice.prefix", "Enter an invoice prefix.");
      if (!d.invoice.startSeq.trim()) e["invoice.startSeq"] = "Enter a starting number.";
      else if (!Number.isInteger(Number(d.invoice.startSeq)) || Number(d.invoice.startSeq) < 1)
        e["invoice.startSeq"] = "Enter a whole number (1 or more).";
      req(!d.invoice.terms.trim(), "invoice.terms", "Enter your terms & conditions.");
      break;
    case 5:
      d.godowns.forEach((g, gi) => {
        req(!g.name.trim(), `godowns.${gi}.name`, "Enter a name.");
        req(!g.state.trim(), `godowns.${gi}.state`, "Enter the state.");
        if (!g.stateCode.trim()) e[`godowns.${gi}.stateCode`] = "Enter the code.";
        else if (!CODE_RE.test(g.stateCode.trim())) e[`godowns.${gi}.stateCode`] = "2-digit code.";
      });
      break;
    case 6:
      if (!TIME_RE.test(d.tracking.se)) e["tracking.se"] = "Set a valid time.";
      if (!TIME_RE.test(d.tracking.logistics)) e["tracking.logistics"] = "Set a valid time.";
      break;
    case 7:
      Object.assign(e, validateDues(d.duesBands));
      break;
    default:
      break;
  }
  return e;
}

/** Exactly 4 contiguous bands (0 → ∞); mirrors the server's validateDuesBands. */
function validateDues(bands: DuesBand[]): Errors {
  const e: Errors = {};
  if (bands.length !== 4) {
    e["dues"] = "There must be exactly 4 collection-dues bands.";
    return e;
  }
  for (let i = 0; i < 4; i++) {
    const b = bands[i];
    if (!b.label.trim()) e[`dues.${i}.label`] = "Label?";
    if (b.fromDays.trim() === "" || Number.isNaN(Number(b.fromDays))) e[`dues.${i}.from`] = "Number?";
  }
  if (Number(bands[0].fromDays) !== 0) e["dues.0.from"] = "Start at 0.";
  if (bands[3].toDays.trim() !== "") e["dues.3.to"] = "Leave blank.";
  for (let i = 0; i < 3; i++) {
    const to = Number(bands[i].toDays);
    if (bands[i].toDays.trim() === "" || Number.isNaN(to)) e[`dues.${i}.to`] = "Number?";
    else if (Number(bands[i + 1].fromDays) !== to + 1) e[`dues.${i + 1}.from`] = `Use ${to + 1}.`;
  }
  return e;
}

function stepIsValid(i: number, d: Data): boolean {
  return Object.keys(validateStep(i, d)).length === 0;
}

/** First step (0–7) with validation errors, or null if the whole form is valid. */
function firstInvalidStep(d: Data): number | null {
  for (let i = 0; i < LAST; i++) if (!stepIsValid(i, d)) return i;
  return null;
}

/** Hour from an "HH:MM" string, with a safe fallback for empty / malformed input. */
function hourOf(v: string, fallback: number): number {
  const h = Number((v || "").split(":")[0]);
  return v.trim() && Number.isInteger(h) && h >= 0 && h <= 23 ? h : fallback;
}

/** Uppercase the first letter after each space; the rest of each word is left
 *  exactly as typed. Applied only to name / place fields. */
function capWords(s: string): string {
  return s.replace(/(^|\s)(\p{L})/gu, (_m, sp: string, ch: string) => sp + ch.toUpperCase());
}

function Field({
  label,
  children,
  hint,
  error,
  optional,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string;
  optional?: boolean;
}) {
  const id = useId();
  const errId = `${id}-err`;
  const hintId = `${id}-hint`;
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id,
        "aria-required": optional ? undefined : true,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error ? errId : hint ? hintId : undefined,
      })
    : children;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {optional ? null : <span className="text-destructive" aria-hidden> *</span>}
      </Label>
      {control}
      {error ? (
        <p id={errId} className="text-[11.5px] font-medium text-destructive">{error}</p>
      ) : hint ? (
        <span id={hintId} className="text-[11.5px] text-muted-foreground">{hint}</span>
      ) : null}
    </div>
  );
}

function Mand({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-[11.5px] text-muted-foreground ${className ?? ""}`}>
      {children ?? <><b className="font-semibold text-foreground">Fields marked *</b> are required.</>}
    </div>
  );
}

export function OnboardingWizard({ initial, rejectedReason }: { initial: Partial<Data> & { currentStep?: number } | null; rejectedReason?: string | null }) {
  const router = useRouter();
  const start = { ...EMPTY, ...(initial ?? {}) } as Data;
  const startStep = Math.max(0, Math.min(initial?.currentStep ?? 0, LAST));
  const [data, setData] = useState<Data>(start);
  const [step, setStep] = useState<number>(startStep);
  // Steps the user has tried to leave/submit — errors only show once attempted.
  const [attempted, setAttempted] = useState<Set<number>>(() => new Set());
  // Steps the user has actually landed on — a ✓ needs this (so steps with valid
  // DEFAULTS, e.g. tracking/dues, aren't ticked before they've been seen). A
  // resumed draft counts every step up to where it left off as visited.
  const [visited, setVisited] = useState<Set<number>>(() => new Set(Array.from({ length: startStep + 1 }, (_, k) => k)));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const firstRender = useRef(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const markAttempted = (i: number) => setAttempted((a) => (a.has(i) ? a : new Set(a).add(i)));
  const markVisited = (i: number) => setVisited((v) => (v.has(i) ? v : new Set(v).add(i)));
  // Errors are DERIVED from the current data (not stored), so fixing a field
  // clears its message live; they surface only after the step was attempted.
  const shown: Errors = attempted.has(step) ? validateStep(step, data) : {};
  const err = (key: string) => shown[key];

  // Debounced autosave of the draft, with a visible save state (incl. failures).
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    setSaveState("saving");
    const id = setTimeout(async () => {
      try {
        const res = await fetch("/api/onboarding", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: data, currentStep: step }),
        });
        if (!res.ok) throw new Error("save failed");
        setSaveState("saved");
        setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1600);
      } catch {
        setSaveState("error");
      }
    }, 700);
    return () => clearTimeout(id);
  }, [data, step]);

  // On step change bring the form into view and move focus to the step heading
  // (the card can exceed the viewport, so this scrolls the page, not an inner box).
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
    const h = headingRef.current;
    if (h) requestAnimationFrame(() => h.focus());
  }, [step]);

  const upd = useCallback(<K extends keyof Data>(key: K, patch: Partial<Data[K]>) => {
    setData((d) => ({ ...d, [key]: { ...(d[key] as object), ...patch } }));
  }, []);

  function toPayload() {
    return {
      admin: data.admin,
      company: data.company,
      address: { ...data.address, line2: data.address.line2 || null },
      bank: data.bank,
      invoice: { ...data.invoice, startSeq: Number(data.invoice.startSeq) },
      godowns: data.godowns,
      tracking: {
        seAutoStopHour: hourOf(data.tracking.se, 20),
        logisticsAutoStopHour: hourOf(data.tracking.logistics, 22),
      },
      duesBands: data.duesBands.map((b) => ({
        fromDays: Number(b.fromDays), toDays: b.toDays.trim() === "" ? null : Number(b.toDays), label: b.label,
      })),
    };
  }

  async function submit() {
    const bad = firstInvalidStep(data);
    if (bad !== null) {
      markAttempted(bad);
      markVisited(bad);
      setStep(bad);
      setError("Some details need fixing — the step with the problem is now open and the fields are highlighted.");
      return;
    }
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

  const goTo = (i: number) => { const t = Math.max(0, Math.min(i, LAST)); setError(null); setStep(t); markVisited(t); };
  const next = () => {
    if (step === LAST) { void submit(); return; }
    if (stepIsValid(step, data)) { const t = Math.min(LAST, step + 1); setError(null); setStep(t); markVisited(t); }
    else markAttempted(step);
  };
  const back = () => goTo(step - 1);
  const pct = ((step + 1) / STEPS.length) * 100;

  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{
        // Hex (not oklch) so it renders on pre-2023 browsers (e.g. Win 7/8 Chromium).
        backgroundColor: "#f2f5f9",
        backgroundImage:
          "radial-gradient(1100px 560px at 12% -8%, #dbe9fc, transparent 55%), radial-gradient(900px 620px at 112% 118%, #dee9f9, transparent 50%)",
      }}
    >
      {/* ~70% × 70% centered split surface on laptop+; a single full card below lg
          (at md the 300px tracker leaves the form column far too narrow). Height is
          a MIN, so the card grows to fit each step instead of scrolling inside. */}
      <div className="flex min-h-[70vh] w-[70vw] max-w-[1180px] overflow-hidden rounded-[20px] border border-border bg-card shadow-[0_18px_50px_-20px_rgba(15,23,42,0.30),0_4px_14px_-8px_rgba(15,23,42,0.18)] max-lg:min-h-0 max-lg:w-full max-lg:max-w-[480px]">
        {/* ── Step tracker (shown on laptop+ only) ── */}
        <aside
          className="relative hidden w-[300px] flex-none overflow-hidden p-8 lg:flex lg:flex-col"
          style={{
            backgroundColor: "#2751b8",
            backgroundImage:
              "linear-gradient(155deg, #2751b8 0%, #3a81f5 62%, #59a0f9 100%)",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              background:
                "radial-gradient(420px 300px at 90% 4%, rgba(255,255,255,0.18), transparent 60%), radial-gradient(360px 300px at 0% 100%, rgba(255,255,255,0.12), transparent 60%)",
            }}
          />
          <div className="relative flex h-full flex-col">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[rgba(255,255,255,0.7)]">Company setup</div>
            <div className="mt-1 text-[14px] font-semibold text-white">Step {step + 1} of {STEPS.length}</div>
            <div className="mt-3 h-[6px] overflow-hidden rounded-full bg-[rgba(255,255,255,0.2)]">
              <div className="h-full rounded-full bg-white transition-[width] duration-300" style={{ width: `${pct}%` }} />
            </div>

            <ol className="mt-6 flex flex-1 list-none flex-col gap-0.5 overflow-auto p-0">
              {STEPS.map((name, i) => {
                const current = i === step;
                // A tick means the step was VISITED and passes validation — so steps
                // with valid defaults aren't ticked before the user has seen them.
                const complete = i !== LAST && visited.has(i) && stepIsValid(i, data);
                return (
                  <li key={name}>
                    <button
                      type="button"
                      aria-current={current ? "step" : undefined}
                      onClick={() => goTo(i)}
                      className={`flex w-full items-center gap-3 rounded-[9px] px-2.5 py-2 text-left text-[13px] transition-colors ${
                        current ? "bg-[rgba(255,255,255,0.12)] font-semibold text-white" : "text-[rgba(255,255,255,0.7)] hover:bg-[rgba(255,255,255,0.1)] hover:text-white"
                      }`}
                    >
                      <span
                        className={`grid h-[23px] w-[23px] flex-none place-items-center rounded-full text-[11.5px] font-bold ${
                          complete ? "bg-white text-[#2751b8]" : current ? "border-[1.5px] border-white text-white" : "border-[1.5px] border-[rgba(255,255,255,0.35)] text-[rgba(255,255,255,0.55)]"
                        }`}
                      >
                        {complete ? (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
                        ) : (
                          i + 1
                        )}
                      </span>
                      {name}
                    </button>
                  </li>
                );
              })}
            </ol>

            <div className="mt-auto border-t border-[rgba(255,255,255,0.2)] pt-3.5 text-[11.5px] text-[rgba(255,255,255,0.7)]">
              You can revisit any step before you submit.
            </div>
          </div>
        </aside>

        {/* ── Form side ── */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div ref={scrollRef} className="flex-1 p-10 max-lg:p-7 [&_[data-slot=input]]:h-10 [&_[data-slot=input]]:text-[13.5px]">
            <div className="mx-auto max-w-[560px]">
              <div className="mb-4 text-[13px] text-muted-foreground lg:hidden">Step {step + 1} of {STEPS.length} · {STEPS[step]}</div>
              {rejectedReason ? (
                <div className="mb-5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
                  Your previous submission was returned: {rejectedReason}. Update your details and resubmit.
                </div>
              ) : null}
              {error ? (
                <div role="alert" className="mb-5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{error}</div>
              ) : null}

              {step === 0 && (
                <Step headingRef={headingRef} title="Administrator" lead="You'll be the first Super Admin for this company." required>
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <Field label="Full name" error={err("admin.name")}><Input value={data.admin.name} onChange={(e) => upd("admin", { name: capWords(e.target.value) })} autoComplete="name" /></Field>
                    <Field label="Designation" error={err("admin.designation")}><Input value={data.admin.designation} onChange={(e) => upd("admin", { designation: capWords(e.target.value) })} placeholder="e.g. Director" /></Field>
                  </div>
                </Step>
              )}

              {step === 1 && (
                <Step headingRef={headingRef} title="Company identity" lead="As it should appear on your GST tax invoices." required>
                  <Field label="Legal company name" error={err("company.legalName")}><Input value={data.company.legalName} onChange={(e) => upd("company", { legalName: capWords(e.target.value) })} /></Field>
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <Field label="GSTIN" optional error={err("company.gstin")}><Input className="font-mono uppercase" value={data.company.gstin} onChange={(e) => upd("company", { gstin: e.target.value.toUpperCase() })} /></Field>
                    <Field label="Trade / display name" error={err("company.tradeName")}><Input value={data.company.tradeName} onChange={(e) => upd("company", { tradeName: capWords(e.target.value) })} /></Field>
                  </div>
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <Field label="Business phone" error={err("company.contactPhone")}><Input inputMode="tel" value={data.company.contactPhone} onChange={(e) => upd("company", { contactPhone: e.target.value })} /></Field>
                    <Field label="Business email" error={err("company.contactEmail")}><Input type="email" value={data.company.contactEmail} onChange={(e) => upd("company", { contactEmail: e.target.value })} /></Field>
                  </div>
                </Step>
              )}

              {step === 2 && (
                <Step headingRef={headingRef} title="Registered address" lead="Your principal place of business." required>
                  <Field label="Address line 1" error={err("address.line1")}><Input value={data.address.line1} onChange={(e) => upd("address", { line1: capWords(e.target.value) })} /></Field>
                  <Field label="Address line 2" optional><Input value={data.address.line2} onChange={(e) => upd("address", { line2: capWords(e.target.value) })} /></Field>
                  <div className="grid gap-3.5 sm:grid-cols-3">
                    <Field label="City" error={err("address.city")}><Input value={data.address.city} onChange={(e) => upd("address", { city: capWords(e.target.value) })} /></Field>
                    <Field label="State" error={err("address.state")}><Input value={data.address.state} onChange={(e) => upd("address", { state: capWords(e.target.value) })} /></Field>
                    <Field label="Pincode" error={err("address.pincode")}><Input className="font-mono" inputMode="numeric" value={data.address.pincode} onChange={(e) => upd("address", { pincode: e.target.value })} /></Field>
                  </div>
                </Step>
              )}

              {step === 3 && (
                <Step headingRef={headingRef} title="Banking & payment" lead="Printed on your invoices so customers can pay you." required>
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <Field label="Bank name" error={err("bank.bankName")}><Input value={data.bank.bankName} onChange={(e) => upd("bank", { bankName: capWords(e.target.value) })} /></Field>
                    <Field label="Account holder name" error={err("bank.accountName")}><Input value={data.bank.accountName} onChange={(e) => upd("bank", { accountName: capWords(e.target.value) })} /></Field>
                  </div>
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <Field label="Account number" error={err("bank.accountNumber")}><Input className="font-mono" inputMode="numeric" value={data.bank.accountNumber} onChange={(e) => upd("bank", { accountNumber: e.target.value })} /></Field>
                    <Field label="IFSC code" error={err("bank.ifsc")}><Input className="font-mono uppercase" value={data.bank.ifsc} onChange={(e) => upd("bank", { ifsc: e.target.value.toUpperCase() })} /></Field>
                  </div>
                  <Field label="UPI ID" error={err("bank.upiId")} hint="Shown with a QR code on every invoice."><Input className="font-mono" value={data.bank.upiId} onChange={(e) => upd("bank", { upiId: e.target.value })} /></Field>
                </Step>
              )}

              {step === 4 && (
                <Step headingRef={headingRef} title="Invoice setup" lead="Your invoice numbering and the terms printed on each one." required>
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <Field label="Invoice prefix" error={err("invoice.prefix")} hint="e.g. ACM/2026-27/"><Input className="font-mono" value={data.invoice.prefix} onChange={(e) => upd("invoice", { prefix: e.target.value })} /></Field>
                    <Field label="Starting number" error={err("invoice.startSeq")}><Input className="font-mono" inputMode="numeric" value={data.invoice.startSeq} onChange={(e) => upd("invoice", { startSeq: e.target.value })} /></Field>
                  </div>
                  <Field label="Terms & conditions" error={err("invoice.terms")} hint="Pre-filled with a standard default — edit to match your business.">
                    <Textarea className="min-h-[110px] font-mono text-[13px]" value={data.invoice.terms} onChange={(e) => upd("invoice", { terms: e.target.value })} onKeyDown={onTermsKeyDown} />
                  </Field>
                </Step>
              )}

              {step === 5 && (
                <Step headingRef={headingRef} title="Godowns" lead="At least one stock location is required." required>
                  {data.godowns.map((g, i) => (
                    <div key={i} className="mb-3 rounded-[7px] border border-border bg-secondary p-4 pb-1">
                      <div className="mb-2.5 flex items-center justify-between">
                        <b className="text-[12.5px]">Godown {i + 1}{i === 0 ? " · Primary" : ""}</b>
                        {i > 0 ? <button type="button" onClick={() => setData((d) => ({ ...d, godowns: d.godowns.filter((_, j) => j !== i) }))} className="rounded px-1.5 py-0.5 text-[12px] font-semibold text-destructive hover:bg-destructive/10">Remove</button> : null}
                      </div>
                      <div className="grid gap-3.5 sm:grid-cols-2">
                        <Field label="Name" error={err(`godowns.${i}.name`)}><Input value={g.name} onChange={(e) => setGodown(i, { name: capWords(e.target.value) })} /></Field>
                        <Field label="City" optional><Input value={g.city} onChange={(e) => setGodown(i, { city: capWords(e.target.value) })} /></Field>
                        <Field label="State" error={err(`godowns.${i}.state`)}><Input value={g.state} onChange={(e) => setGodown(i, { state: capWords(e.target.value) })} /></Field>
                        <Field label="GST state code" error={err(`godowns.${i}.stateCode`)}><Input className="font-mono" inputMode="numeric" value={g.stateCode} onChange={(e) => setGodown(i, { stateCode: e.target.value })} /></Field>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => setData((d) => ({ ...d, godowns: [...d.godowns, { name: "", city: "", state: "", stateCode: "" }] }))} className="w-full rounded-[7px] border border-dashed border-border bg-transparent p-2.5 text-[13px] font-semibold text-primary hover:bg-primary/10">+ Add another godown</button>
                </Step>
              )}

              {step === 6 && (
                <Step headingRef={headingRef} title="Field tracking" lead="When the day's GPS tracking auto-stops for each team." required>
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <Field label="Sales Executive auto-stop" error={err("tracking.se")} hint="Field day typically ends by evening."><Input type="time" value={data.tracking.se} onChange={(e) => upd("tracking", { se: e.target.value })} /></Field>
                    <Field label="Logistics auto-stop" error={err("tracking.logistics")} hint="Delivery runs often finish later."><Input type="time" value={data.tracking.logistics} onChange={(e) => upd("tracking", { logistics: e.target.value })} /></Field>
                  </div>
                </Step>
              )}

              {step === 7 && (
                <Step headingRef={headingRef} title="Collection dues bands" lead="How overdue money is aged. A customer sits in one band by how long their oldest overdue invoice has been past due.">
                  <Mand className="mb-5"><b className="font-semibold text-foreground">Exactly 4 bands</b> — contiguous, starting at day 0; the last is open-ended (leave its To blank). Edit the ranges + labels to suit your business.</Mand>
                  {data.duesBands.map((b, i) => (
                    <div key={i} className="mb-2.5 grid grid-cols-[1fr_1fr] items-start gap-2.5 sm:grid-cols-[90px_90px_1fr]">
                      <Field label="From" error={err(`dues.${i}.from`)}><Input className="font-mono" inputMode="numeric" value={b.fromDays} onChange={(e) => setBand(i, { fromDays: e.target.value })} /></Field>
                      <Field label="To" error={err(`dues.${i}.to`)}><Input className="font-mono" inputMode="numeric" value={b.toDays} onChange={(e) => setBand(i, { toDays: e.target.value })} placeholder={i === data.duesBands.length - 1 ? "∞" : ""} /></Field>
                      <Field label="Label" error={err(`dues.${i}.label`)}><Input value={b.label} onChange={(e) => setBand(i, { label: capWords(e.target.value) })} /></Field>
                    </div>
                  ))}
                </Step>
              )}

              {step === 8 && (
                <Step headingRef={headingRef} title="Review & submit" lead="Check everything, then submit for approval. You can't use the app until it's approved.">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Rev title="Administrator" to={0} go={goTo} rows={[["Name", data.admin.name], ["Role", data.admin.designation]]} />
                    <Rev title="Company" to={1} go={goTo} rows={[["Legal", data.company.legalName], ["GSTIN", data.company.gstin], ["Phone", data.company.contactPhone], ["Email", data.company.contactEmail]]} />
                    <Rev title="Address" to={2} go={goTo} rows={[["Line 1", data.address.line1], ["City", data.address.city], ["State", `${data.address.state}${data.address.pincode ? ` · ${data.address.pincode}` : ""}`]]} />
                    <Rev title="Banking" to={3} go={goTo} rows={[["Bank", data.bank.bankName], ["A/C", data.bank.accountNumber], ["IFSC", data.bank.ifsc], ["UPI", data.bank.upiId]]} />
                    <Rev title="Invoicing" to={4} go={goTo} rows={[["Series", `${data.invoice.prefix}${data.invoice.startSeq}`], ["Terms", `${data.invoice.terms.split("\n").filter(Boolean).length} clauses`]]} />
                    <Rev title="Godowns" to={5} go={goTo} rows={[["Count", String(data.godowns.length)], ["Primary", data.godowns[0]?.name ?? ""]]} />
                    <Rev title="Field tracking" to={6} go={goTo} rows={[["SE stops", data.tracking.se], ["Logistics", data.tracking.logistics]]} />
                    <Rev title="Collection dues" to={7} go={goTo} rows={[["Bands", String(data.duesBands.length)], ["Oldest", data.duesBands[data.duesBands.length - 1]?.label ?? ""]]} />
                  </div>
                </Step>
              )}
            </div>
          </div>

          {/* nav footer — pinned at the bottom of the surface */}
          <div className="flex items-center gap-3 border-t border-border px-10 py-4 max-lg:px-7">
            {step > 0 ? <Button variant="outline" onClick={back} disabled={submitting}>Back</Button> : null}
            <SaveStatus state={saveState} />
            <span className="flex-1" />
            <Button onClick={next} disabled={submitting}>
              {step === LAST ? (submitting ? "Submitting…" : "Submit for approval") : "Continue"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  // Write new terms text + restore the caret (the textarea is controlled, so the
  // caret must be re-placed on the next frame, after React updates the value).
  function commitTerms(ta: HTMLTextAreaElement, value: string, caret: number) {
    upd("invoice", { terms: value });
    requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = caret; });
  }

  // Auto-continue a numbered list in the T&C box: Enter on "N. text" starts a new
  // line pre-filled with "N+1. "; Enter on an empty "N. " exits the list; Shift+
  // Enter and non-list lines fall through to a plain newline.
  function onTermsKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey) return;
    const ta = e.currentTarget;
    const { selectionStart, selectionEnd, value } = ta;
    if (selectionStart !== selectionEnd) return; // leave range-replace to the default
    const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
    const line = value.slice(lineStart, selectionStart);
    const m = /^(\s*)(\d+)\.\s+(.*)$/.exec(line);
    if (!m) return; // not a numbered line → normal newline
    const [, indent, numStr, rest] = m;
    const after = value.slice(selectionStart);
    e.preventDefault();
    if (rest.trim() === "") {
      // Empty item → exit the list: clear the marker, leaving a blank line.
      commitTerms(ta, value.slice(0, lineStart) + indent + after, lineStart + indent.length);
      return;
    }
    const insert = `\n${indent}${Number(numStr) + 1}. `;
    commitTerms(ta, value.slice(0, selectionStart) + insert + after, selectionStart + insert.length);
  }

  function setGodown(i: number, patch: Partial<Godown>) {
    setData((d) => ({ ...d, godowns: d.godowns.map((g, j) => (j === i ? { ...g, ...patch } : g)) }));
  }
  function setBand(i: number, patch: Partial<DuesBand>) {
    setData((d) => ({ ...d, duesBands: d.duesBands.map((b, j) => (j === i ? { ...b, ...patch } : b)) }));
  }
}

/** Autosave status in the footer — announces changes politely for screen readers. */
function SaveStatus({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  const map = {
    idle: { text: "", cls: "" },
    saving: { text: "Saving…", cls: "text-muted-foreground" },
    saved: { text: "Saved", cls: "text-[#1c8742]" },
    error: { text: "Couldn’t save — check your connection", cls: "text-destructive" },
  } as const;
  const { text, cls } = map[state];
  return (
    <span aria-live="polite" className={`text-[12px] font-semibold transition-opacity ${cls} ${text ? "opacity-100" : "opacity-0"}`}>
      {text || " "}
    </span>
  );
}

function Step({ title, lead, children, headingRef, required }: { title: string; lead: string; children: ReactNode; headingRef?: React.Ref<HTMLHeadingElement>; required?: boolean }) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <h3 ref={headingRef} tabIndex={-1} className="min-w-0 text-[20px] font-bold tracking-tight outline-none">{title}</h3>
        {required ? <Mand className="mt-0.5 shrink-0" /> : null}
      </div>
      <p className="mb-5 mt-0.5 text-[13px] text-muted-foreground">{lead}</p>
      <div className="flex flex-col gap-3.5">{children}</div>
    </div>
  );
}

function Rev({ title, to, go, rows }: { title: string; to: number; go: (n: number) => void; rows: Array<[string, string]> }) {
  return (
    <div className="rounded-[7px] border border-border bg-secondary px-[15px] py-[13px]">
      <div className="mb-2 flex justify-between text-[12px] font-bold uppercase tracking-[0.04em] text-muted-foreground">
        {title}
        <button type="button" onClick={() => go(to)} className="text-[12px] font-semibold normal-case tracking-normal text-primary hover:underline">Edit</button>
      </div>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1 text-[12.5px]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="m-0 truncate text-right font-medium">{v || "—"}</dd></div>
        ))}
      </dl>
    </div>
  );
}
