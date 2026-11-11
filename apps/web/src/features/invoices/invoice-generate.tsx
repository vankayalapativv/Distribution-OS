"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { withQueryClient } from "@/components/data-table/query-provider";
import { PageHeader } from "@/components/page-header";
import { DashboardShell } from "@/features/shell/dashboard-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect } from "@/components/ui/search-select";
import { errorMessage, type ActionConfig } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { fetchLocations, fetchSkus } from "@/features/stock/stock-api";
import { InvoiceBillTo } from "./invoice-bill-to";
import { InvoiceDateField } from "./invoice-date-field";
import { InvoiceLineTable } from "./invoice-line-table";
import { InvoiceGenerateSummary } from "./invoice-generate-summary";
import {
  editInvoice, fetchBalancesForSkus, fetchCustomerDetail, fetchNextInvoiceNumber, generateInvoice,
  initialFormLines, supplyTypeOf, toGenerateLines,
  type GenerateLine, type InvoiceEditData, type InvoiceFormLine, type OrderInvoiceSeed,
} from "./invoice-generate-api";

type Role = "SUPER_ADMIN" | "ACCOUNTANT";
// Shared eyebrow label — same treatment as the Bill-to "Billing address · place
// of supply" micro-labels, used for every field label on the form.
const FIELD_LABEL = "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground";
const EMPTY_STOCK = new Map<string, number>();
const keyOf = (l: InvoiceFormLine) => `${l.productId}|${l.packSizeLitres}`;
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const emptyLine = (): InvoiceFormLine => ({
  uid: crypto.randomUUID(), productId: "", productName: "", packSizeLitres: 0,
  brand: null, segment: null, hsnCode: null, qty: "", rate: "", mrp: "", discountPct: "0", orderItemId: null, maxUnits: null,
});

/** Initial header-field values: the edited invoice's header, else the order
 *  seed's customer / blanks (+ today's date). Keeps the many `edit?.… ??` reads
 *  out of the component body. */
function initialHeaderState(edit: InvoiceEditData | null | undefined, seed: OrderInvoiceSeed | null | undefined) {
  return {
    customerId: edit?.customer.id ?? seed?.customerId ?? "",
    locationId: edit?.location.id ?? "",
    invoiceDate: edit?.header.invoiceDate ?? today(),
    irn: edit?.header.irn ?? "",
    eway: edit?.header.ewayBillNo ?? "",
    reverseCharge: edit?.header.reverseCharge ?? false,
    transport: edit?.header.transport ?? "",
    vehicleNo: edit?.header.vehicleNo ?? "",
    grRrNo: edit?.header.grRrNo ?? "",
    station: edit?.header.station ?? "",
    transportCharge: edit?.header.transportCharge ? String(edit.header.transportCharge) : "",
  };
}

/** The provisional invoice number shown at the top of the details card: the
 *  value once known, "—" on a load error, else a loading ellipsis. */
const invoiceNoDisplay = (invoiceNo: string | undefined, isError: boolean): string =>
  invoiceNo ?? (isError ? "—" : "…");

/** Yes/No segmented control for the reverse-charge flag. */
function ReverseChargeToggle({ value, onChange }: Readonly<{ value: boolean; onChange: (v: boolean) => void }>) {
  return (
    <div className="flex h-9 overflow-hidden rounded-md border border-border">
      {([["No", false], ["Yes", true]] as const).map(([lbl, val]) => (
        <button key={lbl} type="button" onClick={() => onChange(val)}
          className={cn("flex-1 text-sm font-medium transition-colors",
            value === val ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}>
          {lbl}
        </button>
      ))}
    </div>
  );
}

/** The amber "editing" / primary "pre-filled from order" context banner, or null. */
function InvoiceContextBanner({ edit, seed }: Readonly<{ edit?: InvoiceEditData | null; seed?: OrderInvoiceSeed | null }>) {
  if (edit) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        Editing <span className="font-mono font-semibold">{edit.invoiceNumber}</span> — saving reverses the old stock and re-applies the new. The invoice number and customer stay the same.
      </div>
    );
  }
  if (seed) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm text-foreground">
        Pre-filled from order <span className="font-mono font-semibold">{seed.orderCode}</span> — quantities are the un-invoiced balance. Set an MRP on each line, then generate.
      </div>
    );
  }
  return null;
}

function InvoiceGenerateInner({ role, actionConfig, seed, edit }: { readonly role: Role; readonly actionConfig: ActionConfig; readonly seed?: OrderInvoiceSeed | null; readonly edit?: InvoiceEditData | null }) {
  const router = useRouter();
  const orderId = edit ? edit.orderId : (seed?.orderId ?? null);
  const locked = edit != null || orderId != null; // customer picker locked from an order or an edit
  const init = initialHeaderState(edit, seed);
  const [customerId, setCustomerId] = useState(init.customerId);
  const [locationId, setLocationId] = useState(init.locationId);
  const [invoiceDate, setInvoiceDate] = useState(init.invoiceDate);
  const [irn, setIrn] = useState(init.irn);
  const [eway, setEway] = useState(init.eway);
  const [reverseCharge, setReverseCharge] = useState(init.reverseCharge);
  const [transport, setTransport] = useState(init.transport);
  const [vehicleNo, setVehicleNo] = useState(init.vehicleNo);
  const [grRrNo, setGrRrNo] = useState(init.grRrNo);
  const [station, setStation] = useState(init.station);
  const [transportCharge, setTransportCharge] = useState(init.transportCharge);
  const [lines, setLines] = useState<InvoiceFormLine[]>(() => initialFormLines(edit, seed));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locQ = useQuery({ queryKey: ["stock-locations"], queryFn: () => fetchLocations(actionConfig) });
  const locations = locQ.data ?? [];
  if (!edit && locationId === "" && locations.length > 0) {
    setLocationId(locations.find((l) => l.isDefault)?.id ?? locations[0].id);
  }

  // Whole catalogue (product × pack) once — feeds the Brand → Segment → SKU → Pack cascade.
  const skuQ = useQuery({ queryKey: ["invoice-skus"], queryFn: () => fetchSkus(actionConfig, "") });

  // Provisional next number for the top of the Invoice details card (new invoices
  // only — an edit already has its real, immutable number).
  const nextNumQ = useQuery({ queryKey: ["invoice-next-number"], queryFn: () => fetchNextInvoiceNumber(actionConfig), enabled: !edit });
  const invoiceNo = edit ? edit.invoiceNumber : nextNumQ.data?.invoiceNumber;

  const custQ = useQuery({
    queryKey: ["invoice-customer-detail", customerId],
    queryFn: () => fetchCustomerDetail(actionConfig, customerId),
    enabled: customerId !== "",
  });
  const detail = custQ.data;
  const supply = supplyTypeOf(detail?.gstNumber ?? null);

  // On-hand at the chosen godown for exactly the lines on screen — refetched when
  // either the godown or the set of lines changes (the per-line stock chips).
  const lineKeys = lines.map(keyOf).sort((a, b) => a.localeCompare(b)).join(",");
  const balQ = useQuery({
    queryKey: ["invoice-stock", locationId, lineKeys],
    queryFn: () => fetchBalancesForSkus(actionConfig, locationId, lines.map((l) => ({ productId: l.productId, packSizeLitres: l.packSizeLitres }))),
    enabled: locationId !== "" && lines.length > 0,
  });
  const stockMap = balQ.data ?? EMPTY_STOCK;
  const balancesReady = balQ.data !== undefined;

  const godownName = edit ? edit.location.name : (locations.find((l) => l.id === locationId)?.name ?? null);
  const setLine = (i: number, patch: Partial<InvoiceFormLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const generate = async () => {
    if (!customerId) return;
    setBusy(true); setError(null);
    const header = {
      placeOfSupply: detail?.addressState ?? edit?.header.placeOfSupply ?? null,
      irn: irn.trim() || null, ewayBillNo: eway.trim() || null,
      reverseCharge,
      transport: transport.trim() || null, vehicleNo: vehicleNo.trim() || null,
      grRrNo: grRrNo.trim() || null, station: station.trim() || null,
      transportCharge: Number(transportCharge) || 0,
    };
    const payload: GenerateLine[] = toGenerateLines(lines);
    try {
      const { invoice } = edit
        ? await editInvoice(actionConfig, edit.invoiceId, { invoiceDate, ...header, lines: payload })
        : await generateInvoice(actionConfig, { customerId, locationId, invoiceDate, orderId, ...header, lines: payload });
      router.push(`/invoices?${edit ? "edited" : "generated"}=${encodeURIComponent(invoice.invoiceNumber)}`);
    } catch (e) {
      setError(errorMessage(e, edit ? "Could not save the invoice." : "Could not generate the invoice."));
      setBusy(false);
    }
  };

  return (
    <DashboardShell role={role} active="invoices">
      <PageHeader crumbs={[{ label: "Invoices", href: "/invoices" }]}
        title={edit ? `Edit invoice ${edit.invoiceNumber}` : "New invoice"}
        subtitle={edit
          ? "Change the lines or header, then save. The number stays the same; stock is re-adjusted from the same godown."
          : "Generate a GST tax invoice. Stock is checked and deducted from the chosen godown as you build the lines."} />

      <InvoiceContextBanner edit={edit} seed={seed} />

      {locations.length === 0 && !locQ.isLoading ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Add a godown first in <Link href="/stock" className="font-semibold underline">Stock Journal</Link> — an invoice deducts stock from a godown.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Top row — Customer · Invoice details · Grand total. Equal height
              across the three columns (grid stretch): they all match whichever is
              tallest, with no inner scroll — shorter cards just have space below. */}
          <div className="grid gap-4 lg:grid-cols-3">
            <InvoiceBillTo actionConfig={actionConfig} customerId={customerId} onSelect={setCustomerId}
              selectedLabel={edit?.customer.name ?? seed?.customerName} detail={detail} supply={supply} locked={locked} />

            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Invoice details</div>
              <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className={FIELD_LABEL}>Billing godown <span className="text-destructive">*</span></Label>
                  {edit ? (
                    <div className="flex h-9 items-center rounded-md border border-border bg-muted/40 px-3 text-sm text-muted-foreground">{edit.location.name ?? "—"}</div>
                  ) : (
                    <SearchSelect items={locations} valueKey={locationId} getKey={(l) => l.id} getLabel={(l) => l.name} onSelect={setLocationId}
                      placeholder="Select a godown" searchPlaceholder="Search godown…" emptyText="No godowns found" contentClassName="w-[280px] p-0" />
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className={FIELD_LABEL}>Invoice date <span className="text-destructive">*</span></Label>
                  <InvoiceDateField value={invoiceDate} onChange={setInvoiceDate} />
                </div>
              </div>
              <div className="mt-3.5 grid gap-3 border-t border-border pt-3.5 sm:grid-cols-2">
                <div className="space-y-1.5"><Label className={FIELD_LABEL}>IRN</Label><Input value={irn} onChange={(e) => setIrn(e.target.value)} /></div>
                <div className="space-y-1.5"><Label className={FIELD_LABEL}>E-way bill no</Label><Input value={eway} onChange={(e) => setEway(e.target.value)} /></div>
              </div>
              <div className="mt-3.5 grid gap-3 border-t border-border pt-3.5 sm:grid-cols-2">
                <div className="space-y-1.5"><Label className={FIELD_LABEL}>Transport</Label><Input value={transport} onChange={(e) => setTransport(e.target.value)} /></div>
                <div className="space-y-1.5"><Label className={FIELD_LABEL}>Vehicle no</Label><Input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} /></div>
                <div className="space-y-1.5"><Label className={FIELD_LABEL}>Station</Label><Input value={station} onChange={(e) => setStation(e.target.value)} /></div>
                <div className="space-y-1.5"><Label className={FIELD_LABEL}>GR / RR no</Label><Input value={grRrNo} onChange={(e) => setGrRrNo(e.target.value)} /></div>
              </div>
              <div className="mt-3.5 grid gap-3 border-t border-border pt-3.5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className={FIELD_LABEL}>Reverse charge</Label>
                  <ReverseChargeToggle value={reverseCharge} onChange={setReverseCharge} />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {/* Invoice number — the real, immutable one when editing; for a new
                  invoice the number it will carry (next in series, shown as fixed;
                  only locked at Generate but never gaps). */}
              <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 shadow-sm">
                <div className={FIELD_LABEL}>Invoice number</div>
                <div className="mt-0.5 font-mono text-xl font-bold leading-none tracking-tight text-foreground">
                  {invoiceNoDisplay(invoiceNo, nextNumQ.isError)}
                </div>
                {!edit && nextNumQ.isError ? (
                  <div className="mt-1 text-[10.5px] leading-tight text-destructive">Couldn&apos;t load the number.</div>
                ) : null}
              </div>

              <InvoiceGenerateSummary lines={lines} supply={supply} stockMap={stockMap} balancesReady={balancesReady}
                hasCustomer={customerId !== ""} godownName={godownName} editing={edit != null}
                transportCharge={transportCharge} onTransportChange={setTransportCharge}
                busy={busy} error={error} onGenerate={generate} />
            </div>
          </div>

          {/* Full-width line items */}
          <InvoiceLineTable lines={lines} skus={skuQ.data ?? []} supply={supply} stockMap={stockMap} balancesReady={balancesReady}
            onAdd={() => setLines((ls) => [...ls, emptyLine()])}
            onChange={setLine}
            onRemove={(i) => setLines((ls) => ls.filter((_, j) => j !== i))} />
        </div>
      )}
    </DashboardShell>
  );
}

export const InvoiceGenerate = withQueryClient(InvoiceGenerateInner);
