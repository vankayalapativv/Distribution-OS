"use client";

import { AlertTriangle } from "lucide-react";
import { type ActionConfig } from "@/lib/api-client";
import { Label } from "@/components/ui/label";
import { CustomerSearchSelect } from "@/features/customers/customer-search-select";
import { rupeesExact } from "@/lib/format";
import { cn } from "@/lib/utils";
import { type CustomerDetail } from "./invoice-generate-api";

const initialsOf = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase() || "?";

/** A labelled block in the detail grid. `full` spans both columns. */
function Cell({ label, full, children }: Readonly<{ label: string; full?: boolean; children: React.ReactNode }>) {
  return (
    <div className={cn("min-w-0 bg-card px-4 py-3", full && "col-span-2")}>
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="break-words text-[13px] leading-relaxed">{children}</div>
    </div>
  );
}

const Dim = ({ children }: { readonly children: React.ReactNode }) => <span className="text-muted-foreground">{children}</span>;

/** The chosen customer's billing block: identity, GST/supply, address (= place
 *  of supply), contact and ledger-accurate account status. A credit-blocked
 *  customer shows a warning banner only — billing stays allowed. */
type ContactLine = { key: string; node: React.ReactNode };

export interface BillToViewModel {
  hasGst: boolean;
  taxLine: string;
  badge: string;
  addr: string[];
  contact: ContactLine[];
  owes: boolean;
  inCredit: boolean;
}

/** Derived display data for the Bill-to card: GST/tax identity, address lines,
 *  contact lines and ledger status (pure — unit tested). */
export function billToView(d: CustomerDetail, supply: "intra" | "inter"): BillToViewModel {
  const addr = [
    d.addressStreet,
    [d.addressCity].filter(Boolean).join(", "),
    [d.addressState, d.addressPincode].filter(Boolean).join(" — "),
  ].filter((l): l is string => l != null && l.length > 0);

  const contact = ([
    d.customerName ? { key: "attn", node: <><Dim>Attn</Dim> {d.customerName}</> } : null,
    d.phone ? { key: "phone", node: d.phone } : null,
    d.alternativePhone ? { key: "alt", node: <><Dim>Alt</Dim> {d.alternativePhone}</> } : null,
    d.email ? { key: "email", node: d.email } : null,
    d.salesExecutiveName ? { key: "se", node: <><Dim>Sales exec</Dim> {d.salesExecutiveName}</> } : null,
  ] as (ContactLine | null)[]).filter((x): x is ContactLine => x !== null);

  return {
    // Tax identity shows ONLY for a GST-registered customer (PAN rides with GSTIN).
    hasGst: Boolean(d.gstNumber),
    taxLine: supply === "intra" ? "Intra-state — CGST + SGST @ 18%" : "Inter-state — IGST @ 18%",
    badge: supply === "intra" ? "CGST+SGST" : "IGST",
    addr,
    contact,
    owes: d.totalOutstanding > 0,
    inCredit: d.totalOutstanding < 0,
  };
}

function BillToDetails({ d, supply }: Readonly<{ d: CustomerDetail; supply: "intra" | "inter" }>) {
  const { hasGst, taxLine, badge, addr, contact, owes, inCredit } = billToView(d, supply);

  return (
    <div className={cn("mt-3 overflow-hidden rounded-xl border", d.creditBlocked ? "border-destructive/45" : "border-border")}>
      <div className="flex items-start gap-3 bg-muted/55 px-4 py-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-accent text-sm font-bold text-accent-foreground">
          {initialsOf(d.legalName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold leading-tight text-foreground">{d.legalName}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {d.tradeName ? <>{d.tradeName} · </> : null}
            <span className="font-mono text-[11px]">{d.customerCode}</span>
          </div>
        </div>
        {hasGst ? (
          <span className="shrink-0 whitespace-nowrap rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">{badge}</span>
        ) : null}
      </div>

      {d.creditBlocked ? (
        <div className="flex items-center gap-2 border-t border-destructive/25 bg-destructive/10 px-4 py-2 text-[12.5px] font-semibold text-destructive">
          <AlertTriangle className="size-[15px] shrink-0" />
          <span>Credit blocked — dues overdue past {d.creditOverdueDays} days. You can still bill; this is a heads-up.</span>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-px border-t border-border bg-border">
        {hasGst ? (
          <Cell label="Tax identity" full>
            GSTIN <span className="font-mono">{d.gstNumber}</span>
            {d.panNumber ? <> · PAN <span className="font-mono">{d.panNumber}</span></> : null}
            <br /><Dim>{taxLine}</Dim>
          </Cell>
        ) : null}
        <Cell label="Billing address · place of supply" full>
          {addr.length > 0
            ? addr.map((l, i) => <span key={l}>{l}{i < addr.length - 1 ? <br /> : null}</span>)
            : <Dim>No address on file</Dim>}
          {d.addressLandmark ? <><br /><Dim>{d.addressLandmark}</Dim></> : null}
        </Cell>
        <Cell label="Contact">
          {contact.length > 0
            ? contact.map((row, i) => <span key={row.key}>{row.node}{i < contact.length - 1 ? <br /> : null}</span>)
            : <Dim>—</Dim>}
        </Cell>
        <Cell label="Account">
          <div className={cn("text-xl font-bold tracking-tight",
            owes ? "text-destructive" : "text-emerald-600 dark:text-emerald-400")}>
            {rupeesExact(Math.abs(d.totalOutstanding))}
            {owes && d.creditBlocked ? <span className="ml-1.5 align-middle rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-600 dark:text-amber-400">overdue</span> : null}
            {inCredit ? <span className="ml-1 text-xs font-medium text-muted-foreground">in credit</span> : null}
          </div>
          <div className="mt-1.5">
            <Dim>Limit</Dim> {rupeesExact(d.creditLimit)} · <Dim>Terms</Dim> {d.creditDays} days
          </div>
        </Cell>
      </div>
    </div>
  );
}

/** The New-Invoice "Customer" card: picker and the selected customer's Bill-to
 *  block. Place of supply is the customer's state (shown in the address block),
 *  so there is no separate place-of-supply field. The e-invoice references (IRN
 *  + E-way) live in the Invoice details card. */
export function InvoiceBillTo({
  actionConfig, customerId, onSelect, selectedLabel, detail, supply, locked = false,
}: Readonly<{
  actionConfig: ActionConfig;
  customerId: string;
  onSelect: (id: string) => void;
  selectedLabel?: string | null;
  detail: CustomerDetail | undefined;
  supply: "intra" | "inter";
  /** Lock the customer to the one seeded from an order — the picker is disabled. */
  locked?: boolean;
}>) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Customer <span className="text-destructive">*</span></Label>
      <div className="mt-1.5">
        <CustomerSearchSelect actionConfig={actionConfig} valueKey={customerId} onSelect={onSelect}
          selectedLabel={selectedLabel ?? undefined} contentClassName="w-[360px] p-0" disabled={locked} />
      </div>

      {customerId && detail ? (
        <BillToDetails d={detail} supply={supply} />
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Pick a customer to see their GST identity, billing address, contact and account status.
        </div>
      )}
    </div>
  );
}
