"use client";

import { useMemo, useState, type ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeftRight, Ban, Check, ChevronLeft, Download, FileMinus, FileText, Info,
  LayoutGrid, Mail, MoreVertical, Store, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { rupees } from "@/lib/format";
import { apiDownload, apiGet, apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import type { CompanyProfile } from "@/lib/company";
import { fetchInvoiceExport, type Gstr1Dataset } from "@/features/invoices/invoice-ca-export";

/** ⋮ kebab holding the report's actions — mirrors the Users-page row menu. */
function ActionsMenu({
  caEmail, busy, sending, hasRows, onDownload, onEmail,
}: Readonly<{ caEmail: string; busy: boolean; sending: boolean; hasRows: boolean; onDownload: () => void; onEmail: () => void }>) {
  const [open, setOpen] = useState(false);
  const item = "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-40";
  const run = (fn: () => void) => { setOpen(false); fn(); };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        title="Actions"
        className="inline-flex size-9 items-center justify-center rounded-xl border border-border bg-white text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <MoreVertical className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" className="w-52 gap-0.5 p-1.5">
        <button type="button" className={cn(item, "text-foreground")} disabled={busy || !hasRows} onClick={() => run(onDownload)}>
          <Download className="size-4 text-muted-foreground" /> {busy ? "Building…" : "Download .xlsx"}
        </button>
        <button
          type="button"
          className={cn(item, "text-foreground")}
          disabled={sending || !hasRows || !caEmail}
          title={!caEmail ? "Add a CA email in Settings → Company" : undefined}
          onClick={() => run(onEmail)}
        >
          <Mail className="size-4 text-muted-foreground" /> {sending ? "Sending…" : "Email to CA"}
        </button>
      </PopoverContent>
    </Popover>
  );
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Month helpers ────────────────────────────────────────────────────────────

const MONTH_FMT = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

/** The last 15 completed-or-current months, newest first, as { value:"YYYY-MM", label }. */
function monthOptions(): { value: string; label: string }[] {
  const now = new Date();
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < 15; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ value, label: MONTH_FMT.format(d) });
  }
  return out;
}

/** "YYYY-MM" → { from, to } covering the whole month. */
function monthRange(ym: string): { from: string; to: string } {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, "0")}` };
}

// ── Aggregation ──────────────────────────────────────────────────────────────

const distinct = <T,>(a: T[], f: (r: T) => string) => new Set(a.map(f)).size;
const sum = <T,>(a: T[], f: (r: T) => number) => a.reduce((s, r) => s + f(r), 0);

interface Fig { label: string; value: string }
interface SectionCardData {
  key: string; name: string; tag: string; sub: string;
  icon: ComponentType<{ className?: string }>; color: string;
  empty: boolean; emptyLabel: string; figs: Fig[];
}

function buildSections(d: Gstr1Dataset): SectionCardData[] {
  const b2bTax = sum(d.b2b, (r) => r.cgst + r.sgst + r.igst);
  const cdNotes = distinct([...d.cdnr, ...d.cdnur], (r) => r.noteNumber);
  const cdValue = sum([...d.cdnr, ...d.cdnur].filter((r, i, a) => a.findIndex((x) => x.noteNumber === r.noteNumber) === i), (r) => r.noteValue);
  const cdTax = sum([...d.cdnr, ...d.cdnur], (r) => r.cgst + r.sgst + r.igst);
  const hsnCodes = distinct([...d.hsnB2b, ...d.hsnB2c], (r) => r.hsnCode);
  const hsnQty = sum([...d.hsnB2b, ...d.hsnB2c], (r) => r.qty);
  const hsnTax = sum([...d.hsnB2b, ...d.hsnB2c], (r) => r.taxable);
  const docsIssued = d.docs.reduce((s, r) => s + r.issued, 0);
  const docsCancelled = d.docs.reduce((s, r) => s + r.cancelled, 0);
  const exemptVal = sum(d.exemp, (r) => r.exempted);

  return [
    {
      key: "b2b", name: "B2B — registered", tag: "4A · 4B · 6B · 6C", icon: Users, color: "#2563eb",
      sub: `${distinct(d.b2b, (r) => r.invoiceNumber)} invoices · ${distinct(d.b2b, (r) => r.gstin)} recipients`,
      empty: d.b2b.length === 0, emptyLabel: "No B2B supplies",
      figs: [{ label: "Taxable", value: rupees(sum(d.b2b, (r) => r.taxable)) }, { label: "Tax", value: rupees(b2bTax) }],
    },
    {
      key: "b2cl", name: "B2CL — large", tag: "5 · inter-state", icon: ArrowLeftRight, color: "#7c3aed",
      sub: `${distinct(d.b2cl, (r) => r.invoiceNumber)} invoices · > ₹2.5L`,
      empty: d.b2cl.length === 0, emptyLabel: "No large inter-state B2C",
      figs: [{ label: "Taxable", value: rupees(sum(d.b2cl, (r) => r.taxable)) }, { label: "IGST", value: rupees(sum(d.b2cl, (r) => r.igst)) }],
    },
    {
      key: "b2cs", name: "B2CS — counter", tag: "7 · consolidated", icon: Store, color: "#0891b2",
      sub: "by place of supply + rate",
      empty: d.b2cs.length === 0, emptyLabel: "No counter sales",
      figs: [{ label: "Taxable", value: rupees(sum(d.b2cs, (r) => r.taxable)) }, { label: "Tax", value: rupees(sum(d.b2cs, (r) => r.cgst + r.sgst + r.igst)) }],
    },
    {
      key: "cdn", name: "Credit notes", tag: "9B · credit/debit", icon: FileMinus, color: "#db2777",
      sub: `${cdNotes} notes · CDNR + CDNUR`,
      empty: cdNotes === 0, emptyLabel: "No credit/debit notes",
      figs: [{ label: "Note value", value: rupees(cdValue) }, { label: "Tax", value: rupees(cdTax) }],
    },
    {
      key: "exempt", name: "Nil-rated & exempt", tag: "8 · nil / exempt", icon: Ban, color: "#64748b",
      sub: "non-GST outward supplies",
      empty: exemptVal === 0, emptyLabel: "No exempt supplies",
      figs: [{ label: "Exempted", value: rupees(exemptVal) }],
    },
    {
      key: "hsn", name: "HSN summary", tag: "12 · HSN", icon: LayoutGrid, color: "#d97706",
      sub: `${hsnCodes} HSN codes · B2B + B2C`,
      empty: hsnCodes === 0, emptyLabel: "No HSN rows",
      figs: [{ label: "Qty", value: hsnQty.toLocaleString("en-IN") }, { label: "Taxable", value: rupees(hsnTax) }],
    },
    {
      key: "docs", name: "Documents issued", tag: "13 · docs", icon: FileText, color: "#0f766e",
      sub: "Invoices + credit notes",
      empty: docsIssued === 0, emptyLabel: "No documents",
      figs: [{ label: "Issued", value: String(docsIssued) }, { label: "Cancelled", value: String(docsCancelled) }],
    },
  ];
}

// ── Component ────────────────────────────────────────────────────────────────

/** The "GST Report" detail: a dedicated month picker drives a GSTR-1 overview
 *  (KPI tiles + per-section cards), with a one-click .xlsx download (built
 *  server-side in the official GSTN template) and an "Email to CA" action. */
export function ReportsCaExportDetail({
  actionConfig, onBack,
}: Readonly<{ actionConfig: ActionConfig; onBack: () => void }>) {
  const months = useMemo(monthOptions, []);
  // Default to the last completed month (index 1), falling back to the current one.
  const [month, setMonth] = useState(() => months[Math.min(1, months.length - 1)].value);
  const range = useMemo(() => monthRange(month), [month]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const { data, isFetching, isError } = useQuery({
    queryKey: ["invoice-export", range.from, range.to],
    queryFn: () => fetchInvoiceExport(actionConfig, range.from, range.to),
  });
  const { data: companyData } = useQuery({
    queryKey: ["company-ca"],
    queryFn: () => apiGet<{ company: CompanyProfile }>(actionConfig, "/system-settings/company"),
  });
  const caEmail = companyData?.company.caEmail.trim() ?? "";

  const hasRows = Boolean(data && data.totals.invoices > 0);
  const loading = !data && isFetching;

  async function download() {
    if (!hasRows) return;
    setBusy(true); setError(null);
    try {
      const blob = await apiDownload(actionConfig, `/invoices/gstr1.xlsx?from=${range.from}&to=${range.to}`);
      saveBlob(blob, `GSTR1-${range.from}_${range.to}.xlsx`);
    } catch (e) {
      setError(errorMessage(e, "Could not build the export."));
    } finally {
      setBusy(false);
    }
  }

  async function emailToCa() {
    setSending(true); setError(null);
    try {
      const res = await apiRequest<{ to: string }>(actionConfig, "POST", `/invoices/gstr1/email?from=${range.from}&to=${range.to}`);
      setSentTo(res.to);
      setConfirmOpen(false);
    } catch (e) {
      setError(errorMessage(e, "Could not email the report."));
    } finally {
      setSending(false);
    }
  }

  const monthLabel = months.find((m) => m.value === month)?.label ?? month;
  const sections = data ? buildSections(data) : [];
  const populated = sections.filter((s) => !s.empty).length;

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onBack} className="-ml-1 inline-flex w-fit items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
        <ChevronLeft className="size-4" /> All reports
      </button>

      {/* Action header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-white p-5 shadow-sm">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="grid size-11 flex-none place-items-center rounded-xl bg-primary text-xs font-bold tracking-wide text-primary-foreground shadow-md">
            GSTR‑1
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight text-foreground">GST Report</h2>
            <p className="text-xs text-muted-foreground">Outward supplies · official GSTN template</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Select value={month} onValueChange={(v) => { if (v) setMonth(v); }}>
            <SelectTrigger className="min-w-[11.5rem] gap-3 rounded-xl border-border bg-muted/40 px-3.5 py-2 text-left data-[size=default]:h-auto">
              <span className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase leading-none tracking-wider text-muted-foreground/80">Return period</span>
                <SelectValue className="text-sm font-semibold leading-none text-foreground">
                  {(v: unknown) => months.find((m) => m.value === v)?.label ?? String(v ?? "")}
                </SelectValue>
              </span>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} className="max-h-72">
              {months.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <ActionsMenu
            caEmail={caEmail} busy={busy} sending={sending} hasRows={hasRows}
            onDownload={download} onEmail={() => setConfirmOpen(true)}
          />
        </div>
      </div>

      {/* CA status */}
      {caEmail ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-600/25 bg-emerald-50 px-3.5 py-2.5 text-xs text-foreground/80 dark:bg-emerald-950/30">
          <Check className="size-4 flex-none text-emerald-600 dark:text-emerald-400" />
          Report will be emailed to <span className="font-semibold text-foreground">{caEmail}</span>
          {sentTo && <span className="text-emerald-700 dark:text-emerald-400">· sent ✓</span>}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-50 px-3.5 py-2.5 text-xs text-foreground/80 dark:bg-amber-950/30">
          <Info className="size-4 flex-none text-amber-600 dark:text-amber-400" />
          Add your CA&rsquo;s email in <span className="font-medium text-foreground">Settings → Company → Chartered Accountant</span> to enable emailing.
        </div>
      )}
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      {isError ? (
        <p className="rounded-xl border border-border bg-white p-6 text-sm text-muted-foreground shadow-sm">Couldn&rsquo;t load the GST report for {monthLabel}. Try again.</p>
      ) : loading ? (
        <GstReportSkeleton />
      ) : !hasRows ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center">
          <FileText className="mx-auto size-7 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium text-foreground">No generated invoices in {monthLabel}</p>
          <p className="mt-1 text-xs text-muted-foreground">Pick another month, or generate invoices for this period.</p>
        </div>
      ) : (
        <>
          {/* KPI tiles */}
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
            <Kpi label="Documents" value={String(data!.docs.reduce((s, r) => s + r.issued, 0))} sub={docRangeSub(data!)} />
            <Kpi label="Taxable value" value={rupees(data!.totals.taxable)} sub={`across ${populated} sections`} mono />
            <Kpi label="Total tax" value={rupees(data!.totals.tax)} sub={taxSplitSub(data!)} mono />
            <Kpi label="Invoice value" value={rupees(data!.totals.taxable + data!.totals.tax)} sub="taxable + tax" mono accent />
          </div>

          {/* Section cards */}
          <div className="mt-2 flex items-center justify-between px-0.5">
            <h3 className="text-sm font-bold tracking-tight text-foreground">Sections in this return</h3>
            <span className="text-[11px] text-muted-foreground">{populated} of {sections.length} populated</span>
          </div>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {sections.map((s) => <SectionCard key={s.key} s={s} />)}
          </div>

          <div className="mt-3 flex items-center gap-2 px-0.5 text-xs text-muted-foreground">
            <Info className="size-4 flex-none text-muted-foreground/60" />
            Exported as the official 32-sheet GSTN GSTR-1 workbook — your CA imports it straight into the GST Offline Tool.
          </div>
        </>
      )}

      {/* Email confirm */}
      <Dialog open={confirmOpen} onOpenChange={(o) => !sending && setConfirmOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Email the GST report?</DialogTitle>
            <DialogDescription>
              The GSTR-1 workbook for <span className="font-medium text-foreground">{monthLabel}</span> will be emailed to{" "}
              <span className="font-medium text-foreground">{caEmail}</span>.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground">
              {data ? `${data.totals.invoices} documents · taxable ${rupees(data.totals.taxable)}.` : ""}
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(false)} disabled={sending}>Cancel</Button>
            <Button size="sm" onClick={emailToCa} disabled={sending}>{sending ? "Sending…" : "Send to CA"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function docRangeSub(d: Gstr1Dataset): string {
  const inv = d.docs.find((r) => r.issued > 0);
  const cancelled = d.docs.reduce((s, r) => s + r.cancelled, 0);
  if (!inv?.firstNo) return `${cancelled} cancelled`;
  return `${inv.firstNo}–${inv.lastNo} · ${cancelled} cancelled`;
}
function taxSplitSub(d: Gstr1Dataset): string {
  const withTax = [...d.b2b, ...d.b2cs, ...d.cdnr, ...d.cdnur];
  const cgst = sum(withTax, (r) => r.cgst);
  const sgst = sum(withTax, (r) => r.sgst);
  const igst = sum([...withTax, ...d.b2cl], (r) => r.igst);
  const l = (n: number) => (n >= 100000 ? `${(n / 100000).toFixed(1)}L` : Math.round(n).toLocaleString("en-IN"));
  return `C ${l(cgst)} · S ${l(sgst)} · I ${l(igst)}`;
}

function Kpi({ label, value, sub, mono, accent }: Readonly<{ label: string; value: string; sub: string; mono?: boolean; accent?: boolean }>) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${accent ? "border-transparent bg-primary text-primary-foreground" : "border-border bg-white"}`}>
      <div className={`text-[11px] font-semibold uppercase tracking-wide ${accent ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{label}</div>
      <div className={`mt-1.5 text-[22px] font-bold leading-tight tracking-tight ${mono ? "tabular-nums" : ""}`}>{value}</div>
      <div className={`mt-0.5 truncate text-[11px] ${accent ? "text-primary-foreground/75" : "text-muted-foreground/70"}`}>{sub}</div>
    </div>
  );
}

function SectionCard({ s }: Readonly<{ s: SectionCardData }>) {
  const Icon = s.icon;
  return (
    <div className={`group rounded-2xl border border-border bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md ${s.empty ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-2.5">
        <div className="grid size-9 place-items-center rounded-[10px]" style={{ backgroundColor: `color-mix(in srgb, ${s.color} 13%, transparent)`, color: s.color }}>
          <Icon className="size-[18px]" />
        </div>
        <span className="rounded-full border border-border bg-muted/40 px-2 py-[3px] text-[10px] font-bold tracking-wide text-muted-foreground">{s.tag}</span>
      </div>
      <div className="mt-2.5 text-[13.5px] font-bold text-foreground">{s.name}</div>
      <div className="text-xs text-muted-foreground">{s.sub}</div>
      {s.empty ? (
        <div className="mt-3 border-t border-dashed border-border pt-3 text-[11px] text-muted-foreground/70">{s.emptyLabel} this period</div>
      ) : (
        <div className="mt-3 flex gap-5 border-t border-dashed border-border pt-3">
          {s.figs.map((f) => (
            <div key={f.label}>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">{f.label}</div>
              <div className="mt-0.5 text-sm font-bold tabular-nums text-foreground">{f.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Context-aware shimmer ────────────────────────────────────────────────────

/** Loading skeleton shaped exactly like the real overview: 4 KPI tiles + a
 *  7-card section grid, so the layout doesn't jump when data lands. */
function GstReportSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-6 w-24" />
            <Skeleton className="mt-1.5 h-2.5 w-28" />
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between px-0.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <Skeleton className="size-9 rounded-[10px]" />
              <Skeleton className="h-4 w-20 rounded-full" />
            </div>
            <Skeleton className="mt-3 h-3.5 w-32" />
            <Skeleton className="mt-1.5 h-2.5 w-24" />
            <div className="mt-3 flex gap-5 border-t border-dashed border-border pt-3">
              <div><Skeleton className="h-2.5 w-12" /><Skeleton className="mt-1.5 h-4 w-16" /></div>
              <div><Skeleton className="h-2.5 w-8" /><Skeleton className="mt-1.5 h-4 w-14" /></div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
