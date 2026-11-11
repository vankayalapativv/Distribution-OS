"use client";

import Link from "next/link";
import { PackagePlus, Zap } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { lineTax, round2, type InvoiceFormLine } from "./invoice-generate-api";

function busyGenerateLabel(editing: boolean | undefined): string {
  return editing ? "Saving…" : "Generating…";
}

const inr = (v: number) => `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (v: string) => Number(v) || 0;
const keyOf = (l: InvoiceFormLine) => `${l.productId}|${l.packSizeLitres}`;

export interface SummaryProps {
  lines: InvoiceFormLine[];
  supply: "intra" | "inter";
  stockMap: Map<string, number>;
  balancesReady: boolean;
  hasCustomer: boolean;
  godownName: string | null;
  /** The viewer's role — only SUPER_ADMIN can record stock-in, so the shortcut
   *  shows only for them (ACCOUNTANT generates invoices but can't write stock). */
  role?: "SUPER_ADMIN" | "ACCOUNTANT";
  editing?: boolean;
  /** Transportation charge (Porter/Rapido/etc.), as the raw input string. */
  transportCharge: string;
  onTransportChange: (v: string) => void;
  busy: boolean;
  error: string | null;
  onGenerate: () => void;
}

function Row({ label, value, sub }: Readonly<{ label: string; value: string; sub?: boolean }>) {
  return (
    <div className={cn("flex items-center justify-between py-1.5 text-sm text-muted-foreground", sub && "pl-2.5 text-[13px]")}>
      <span>{label}</span><span className="text-foreground">{value}</span>
    </div>
  );
}

export interface SummaryFigures { taxable: number; cgst: number; sgst: number; gst: number; transport: number; grand: number; litres: number; }

/** Taxable/GST/transport/grand + total litres for the priced lines (pure — unit
 *  tested). The transport charge is added to the grand as-is (no GST on it). */
export function summaryFigures(lines: InvoiceFormLine[], supply: "intra" | "inter", transportCharge = 0): SummaryFigures {
  const priced = lines.filter((l) => num(l.qty) > 0 && l.rate.trim() !== "" && num(l.rate) > 0);
  let taxable = 0;
  for (const l of priced) taxable += lineTax(num(l.qty), num(l.rate), supply, num(l.discountPct)).taxable;
  taxable = round2(taxable);
  const gst = round2((taxable * 18) / 100);
  const cgst = round2(gst / 2);
  const sgst = round2(gst - cgst);
  const transport = round2(Math.max(0, transportCharge || 0));
  const grand = round2(taxable + gst + transport);
  const litres = round2(lines.reduce((s, l) => s + num(l.qty) * l.packSizeLitres, 0));
  return { taxable, cgst, sgst, gst, transport, grand, litres };
}

function generateLabel(editing: boolean, lineCount: number, allPriced: boolean, shortCount: number, overCount: number): string {
  if (shortCount > 0) return `Fix ${shortCount} short line${shortCount === 1 ? "" : "s"} to generate`;
  if (overCount > 0) return `Fix ${overCount} over-billed line${overCount === 1 ? "" : "s"} to generate`;
  if (!allPriced || lineCount === 0) return "Set a rate on every line";
  if (editing) return "Save changes";
  return "Generate & deduct stock";
}

export interface GenerateState { blocked: boolean; label: string; shortCount: number; }

/** Whether Generate is allowed + the button label (pure — unit tested). */
export function generateState(p: SummaryProps): GenerateState {
  const priced = p.lines.filter((l) => num(l.qty) > 0 && l.rate.trim() !== "" && num(l.rate) > 0);
  const shortCount = !p.editing && p.balancesReady
    ? p.lines.filter((l) => { const s = p.stockMap.get(keyOf(l)); return s !== undefined && num(l.qty) > s; }).length
    : 0;
  const overCount = p.lines.filter((l) => l.maxUnits != null && num(l.qty) > l.maxUnits).length;
  const allPriced = priced.length === p.lines.length && p.lines.length > 0;
  const blocked = !p.hasCustomer || !p.godownName || p.lines.length === 0 || !allPriced || shortCount > 0 || overCount > 0;
  return { blocked, label: generateLabel(!!p.editing, p.lines.length, allPriced, shortCount, overCount), shortCount };
}

export function InvoiceGenerateSummary(p: Readonly<SummaryProps>) {
  const { taxable, cgst, sgst, gst, grand, litres } = summaryFigures(p.lines, p.supply, num(p.transportCharge));
  const { blocked, label, shortCount } = generateState(p);

  return (
    <>
      <div className="sticky top-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <Row label="Taxable value" value={inr(taxable)} />
        {p.supply === "intra" ? (
          <><Row label="CGST @ 9%" value={inr(cgst)} sub /><Row label="SGST @ 9%" value={inr(sgst)} sub /></>
        ) : (
          <Row label="IGST @ 18%" value={inr(gst)} />
        )}
        <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
          <span className="text-muted-foreground">Transportation charges</span>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            placeholder="0.00"
            aria-label="Transportation charges"
            className="h-7 w-28 text-right"
            value={p.transportCharge}
            onChange={(e) => p.onTransportChange(e.target.value)}
          />
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
          <span className="text-sm font-semibold text-foreground">Grand total</span>
          <span className="text-2xl font-extrabold tracking-tight text-foreground">{inr(grand)}</span>
        </div>
        <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{p.lines.length} line{p.lines.length === 1 ? "" : "s"}</span>
          <span>{litres.toLocaleString("en-IN")} L</span>
        </div>
      </div>

      {p.error && <p className="text-sm font-medium text-destructive">{p.error}</p>}
      <Button size="lg" className="h-12 text-base" disabled={blocked || p.busy} onClick={p.onGenerate}>
        <Zap className="size-5" />{p.busy ? busyGenerateLabel(p.editing) : label}
      </Button>
      {shortCount > 0 ? (
        <div className="space-y-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-center dark:border-amber-900/50 dark:bg-amber-950/30">
          <p className="text-xs leading-relaxed text-amber-900 dark:text-amber-200">
            {shortCount === p.lines.length ? "No stock" : `${shortCount} of ${p.lines.length} lines short`} at{" "}
            <span className="font-semibold">{p.godownName ?? "this godown"}</span>. A godown can&apos;t go negative —
            add stock first, or lower each quantity to what&apos;s on hand.
          </p>
          {p.role === "SUPER_ADMIN" && (
            <Link href="/stock/entry?type=in" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mx-auto")}>
              <PackagePlus className="size-3.5" /> Record stock-in
            </Link>
          )}
        </div>
      ) : p.editing ? (
        <p className="text-center text-xs text-muted-foreground">
          Keeps the same invoice number. Re-adjusts stock and refreshes the PDF.
        </p>
      ) : null}
    </>
  );
}
