"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SearchSelect } from "@/components/ui/search-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { istTodayYmd } from "@/components/form/date-field";
import { errorMessage, type ActionConfig } from "@/lib/api-client";
import { MoreVertical, Upload } from "lucide-react";
import { SkuPicker } from "./stock-sku-picker";
import {
  fetchBrands, fetchSkus, postAdjustment, postGrn, postOpening, postTransfer, type StockLocation,
} from "./stock-api";
import {
  DateCell, GrnGrid, LocationSelect, OpeningGrid, REASONS, keyOf, num, rateMissing, useLines, valid, type Line,
} from "./stock-dialogs";
import { downloadStockTemplate, type ImportedStockLine } from "./stock-import";
import { StockImportDialog } from "./stock-import-dialog";
import { TransferGrid, lineOk, useTransferLines } from "./stock-transfer-grid";
import { AdjustGrid, adjLineOk, adjSign, useAdjustLines, type AdjustLine } from "./stock-adjust-grid";

interface PanelProps {
  readonly actionConfig: ActionConfig;
  readonly locations: StockLocation[];
  /** Register a node (the Import kebab) into the page header's right side. */
  readonly onHeaderAction?: (node: ReactNode) => void;
}
const defaultLoc = (ls: StockLocation[]) => ls.find((l) => l.isDefault)?.id ?? ls[0]?.id ?? "";
const plural = (n: number) => (n === 1 ? "" : "s");

/** A titled card — mirrors the /stock dashboard Sections. */
function Section({ title, sub, children }: Readonly<{ title: string; sub?: ReactNode; children: ReactNode }>) {
  return (
    <section className="overflow-hidden rounded-xl border border-border">
      <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-2.5">
        <div className="text-sm font-bold text-foreground">{title}{sub && <span className="ml-2 text-xs font-medium text-muted-foreground">{sub}</span>}</div>
      </header>
      <div className="bg-card p-4">{children}</div>
    </section>
  );
}

/** A labelled meta field with an optional required marker / hint. */
function Field({ label, required, hint, children }: Readonly<{ label: string; required?: boolean; hint?: string; children: ReactNode }>) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}{required && <span className="text-destructive">*</span>}{hint && <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">{hint}</span>}</Label>
      {children}
    </div>
  );
}

/** Floating sticky bar with the running summary + Cancel / Post, shared by all panels. */
function ActionBar({ summary, submitLabel, onSubmit, busy, canSubmit, error, onCancel }: Readonly<{
  summary: ReactNode; submitLabel: string; onSubmit: () => void; busy: boolean; canSubmit: boolean; error: string | null; onCancel: () => void;
}>) {
  return (
    <>
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
        <div className="text-sm text-muted-foreground">{summary}</div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button onClick={onSubmit} disabled={busy || !canSubmit}>{busy ? "Saving…" : submitLabel}</Button>
        </div>
      </div>
    </>
  );
}

/** Inline notice naming how many rows still need a rate — the reason Post is blocked. */
function RateGate({ count }: Readonly<{ count: number }>) {
  if (count === 0) return null;
  return (
    <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-[12px] font-medium text-destructive">
      {count} row{plural(count)} {count === 1 ? "needs" : "need"} a rate greater than 0 before you can Post. The missing rate cells are outlined in red.
    </p>
  );
}

function itemsSub(lines: number, units?: number): string | undefined {
  if (lines === 0) return undefined;
  const unitsPart = units == null ? "" : ` · ${units.toLocaleString("en-IN")} unit${plural(units)}`;
  return `${lines} line${plural(lines)}${unitsPart}`;
}

/** Merge imported rows into the entry grid — same SKU overwrites, new SKU appends. */
function mergeImported(setLines: (fn: (prev: Line[]) => Line[]) => void, imported: ImportedStockLine[]) {
  setLines((prev) => {
    const map = new Map(prev.map((l) => [keyOf(l), l]));
    for (const im of imported) {
      map.set(`${im.productId}|${im.packSizeLitres}`, {
        productId: im.productId, productName: im.productName, packSizeLitres: im.packSizeLitres, brand: im.brand, unit: im.unit,
        a: im.qty, b: im.rate, batch: im.batch, expiry: im.expiry, rack: im.rack, shelf: im.shelf, bin: im.bin,
      });
    }
    return [...map.values()];
  });
}

const MENU_ITEM = "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-40";

/** Page-header kebab (⋮) for the stock-in and opening screens: a single
 *  "Import from Excel" action that opens the bulk-import dialog. For stock-in the
 *  item is disabled until a supplier brand is chosen (the import is brand-scoped). */
function ImportMenu({ actionConfig, mode, brand, onLoad }: Readonly<{
  actionConfig: ActionConfig; mode: "stock_in" | "opening"; brand: string | null;
  onLoad: (lines: ImportedStockLine[]) => void;
}>) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data: skus = [] } = useQuery({ queryKey: ["stock-skus-all"], queryFn: () => fetchSkus(actionConfig, ""), staleTime: 60_000 });
  const download = async () => { setBusy(true); try { await downloadStockTemplate(mode, skus, brand); } finally { setBusy(false); } };
  const disabled = mode === "stock_in" && !brand;
  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger
          title="More actions"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-white text-muted-foreground hover:bg-accent hover:text-foreground dark:bg-transparent"
        >
          <MoreVertical className="size-4" />
        </PopoverTrigger>
        <PopoverContent align="end" side="bottom" className="w-52 p-1.5">
          <button type="button" disabled={disabled} onClick={() => { setMenuOpen(false); setOpen(true); }} className={MENU_ITEM}>
            <Upload className="size-4 text-muted-foreground" />Import from Excel
          </button>
          {disabled && <p className="px-2.5 pt-1 text-[11px] text-muted-foreground">Pick a supplier brand first.</p>}
        </PopoverContent>
      </Popover>
      {open && (
        <StockImportDialog
          actionConfig={actionConfig} mode={mode} brand={brand} open={open}
          onClose={() => setOpen(false)} onLoad={onLoad}
          onDownloadTemplate={() => void download()} downloading={busy}
        />
      )}
    </>
  );
}

/** Stock-in — supplier delivery, with batch/expiry/location per line. */
export function StockInPanel({ actionConfig, locations, onHeaderAction }: PanelProps) {
  const router = useRouter();
  const L = useLines();
  const [locationId, setLocationId] = useState(defaultLoc(locations));
  const [date, setDate] = useState(istTodayYmd());
  const [supplierName, setSupplierName] = useState("");
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState("");
  const brandsQ = useQuery({ queryKey: ["stock-brands"], queryFn: () => fetchBrands(actionConfig) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brandWarn, setBrandWarn] = useState<string | null>(null);
  const onImportLoad = useCallback((lines: ImportedStockLine[]) => mergeImported(L.setLines, lines), [L.setLines]);
  useEffect(() => {
    onHeaderAction?.(<ImportMenu actionConfig={actionConfig} mode="stock_in" brand={supplierName || null} onLoad={onImportLoad} />);
    return () => onHeaderAction?.(null);
  }, [actionConfig, supplierName, onImportLoad, onHeaderAction]);
  const total = L.lines.reduce((s, l) => s + (valid(l.b) ? num(l.b) : 0) * (valid(l.a) ? num(l.a) : 0), 0);
  const units = L.lines.reduce((s, l) => s + (valid(l.a) ? num(l.a) : 0), 0);
  const needRate = L.lines.filter(rateMissing).length;
  const canSubmit = Boolean(locationId) && supplierName.trim() !== "" && supplierInvoiceNo.trim() !== "" && L.lines.some((l) => valid(l.a) && num(l.a) > 0) && needRate === 0;
  const back = () => router.push("/stock");

  // Lines are searched within the chosen brand, so switching supplier mid-entry
  // would strand off-brand lines — block it until they're removed.
  const onSupplier = (b: string) => {
    if (b && b !== supplierName && L.lines.length > 0) {
      setBrandWarn(`Remove the ${L.lines.length} line${plural(L.lines.length)} first to switch supplier brand.`);
      return;
    }
    setBrandWarn(null);
    setSupplierName(b);
  };

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      await postGrn(actionConfig, {
        locationId, supplierName: supplierName.trim(), supplierInvoiceNo: supplierInvoiceNo.trim() || null,
        supplierInvoiceDate: null, receivedDate: date, reference: null, note: null,
        lines: L.lines.filter((l) => valid(l.a) && num(l.a) > 0).map((l) => ({
          productId: l.productId, packSizeLitres: l.packSizeLitres, brand: l.brand, qtyUnits: num(l.a), rate: valid(l.b) ? num(l.b) : null,
          batchNumber: l.batch?.trim() || null, expiryDate: l.expiry || null,
          rackNo: l.rack?.trim() || null, shelfNo: l.shelf?.trim() || null, binNo: l.bin?.trim() || null,
        })),
      });
      back();
    } catch (e) { setError(errorMessage(e, "Could not record the stock-in.")); setBusy(false); }
  };

  return (
    <>
      <Section title="Delivery" sub="who & when">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <LocationSelect locations={locations} value={locationId} onChange={setLocationId} label="Receiving godown" required />
          <DateCell value={date} onChange={setDate} label="Received date" required />
          <Field label="Supplier (brand)" required>
            <SearchSelect items={brandsQ.data ?? []} valueKey={supplierName} getKey={(b) => b} getLabel={(b) => b} onSelect={onSupplier} disabled={brandsQ.isLoading} placeholder={brandsQ.isLoading ? "Loading brands…" : "Select a brand"} searchPlaceholder="Search brand…" emptyText="No brands found" contentClassName="w-[280px] p-0" />
            {brandWarn && L.lines.length > 0 && <p className="text-[11px] font-medium text-amber-600">{brandWarn}</p>}
          </Field>
          <Field label="Supplier invoice no" required><Input value={supplierInvoiceNo} onChange={(e) => setSupplierInvoiceNo(e.target.value)} className="h-9" /></Field>
        </div>
      </Section>
      <Section title="Items" sub={itemsSub(L.lines.length, units)}>
        <div className="flex flex-col gap-3">
          <SkuPicker actionConfig={actionConfig} onPick={L.add} excludeKeys={L.keys} brand={supplierName || null} disabled={!supplierName} disabledHint="Select a supplier brand above, then search its products." />
          <GrnGrid lines={L.lines} set={L.set} remove={L.remove} />
          <p className="text-[11px] text-muted-foreground"><b className="text-foreground">Rate is required</b> on every row (must be greater than 0). Batch · Expiry · Rack · Shelf · Bin are optional. An expiry date feeds the Near-expiry (FEFO) report so stock sells oldest-first.</p>
          <RateGate count={needRate} />
        </div>
      </Section>
      {L.lines.length > 0 && (
        <ActionBar onCancel={back} busy={busy} error={error} canSubmit={canSubmit} onSubmit={submit} submitLabel="Post stock-in"
          summary={<>{L.lines.length} line{plural(L.lines.length)} · {units.toLocaleString("en-IN")} unit{plural(units)} · Stock-in value <span className="font-mono font-semibold text-foreground">{total.toLocaleString("en-IN")}</span></>} />
      )}
    </>
  );
}

/** Opening stock — seed go-live balances, with batch/expiry/location per line. */
export function OpeningPanel({ actionConfig, locations, onHeaderAction }: PanelProps) {
  const router = useRouter();
  const L = useLines();
  const [locationId, setLocationId] = useState(defaultLoc(locations));
  const [date, setDate] = useState(istTodayYmd());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onImportLoad = useCallback((lines: ImportedStockLine[]) => mergeImported(L.setLines, lines), [L.setLines]);
  useEffect(() => {
    onHeaderAction?.(<ImportMenu actionConfig={actionConfig} mode="opening" brand={null} onLoad={onImportLoad} />);
    return () => onHeaderAction?.(null);
  }, [actionConfig, onImportLoad, onHeaderAction]);
  const units = L.lines.reduce((s, l) => s + (valid(l.a) ? num(l.a) : 0), 0);
  const value = L.lines.reduce((s, l) => s + (valid(l.a) ? num(l.a) : 0) * (valid(l.b) ? num(l.b) : 0), 0);
  const needRate = L.lines.filter(rateMissing).length;
  const canSubmit = Boolean(locationId) && L.lines.some((l) => valid(l.a) && num(l.a) > 0) && needRate === 0;
  const back = () => router.push("/stock");

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      await postOpening(actionConfig, {
        locationId, openingDate: date,
        lines: L.lines.filter((l) => valid(l.a) && num(l.a) > 0).map((l) => ({
          productId: l.productId, packSizeLitres: l.packSizeLitres, brand: l.brand, qtyUnits: num(l.a),
          rate: valid(l.b) ? num(l.b) : null,
          batchNumber: l.batch?.trim() || null, expiryDate: l.expiry || null,
          rackNo: l.rack?.trim() || null, shelfNo: l.shelf?.trim() || null, binNo: l.bin?.trim() || null,
        })),
      });
      back();
    } catch (e) { setError(errorMessage(e, "Could not save opening stock.")); setBusy(false); }
  };

  return (
    <>
      <Section title="Delivery" sub="where & as of when">
        <div className="grid gap-3 sm:grid-cols-2">
          <LocationSelect locations={locations} value={locationId} onChange={setLocationId} required />
          <DateCell value={date} onChange={setDate} label="As-of date" required />
        </div>
      </Section>
      <Section title="Items" sub={itemsSub(L.lines.length, units)}>
        <div className="flex flex-col gap-3">
          <SkuPicker actionConfig={actionConfig} onPick={L.add} excludeKeys={L.keys} />
          <OpeningGrid lines={L.lines} set={L.set} remove={L.remove} />
          <p className="text-[11px] text-muted-foreground"><b className="text-foreground">Rate is required</b> on every row (must be greater than 0). Batch · Expiry · Rack · Shelf · Bin are optional. An expiry date feeds the Near-expiry (FEFO) report so stock sells oldest-first.</p>
          <RateGate count={needRate} />
        </div>
      </Section>
      {L.lines.length > 0 && (
        <ActionBar onCancel={back} busy={busy} error={error} canSubmit={canSubmit} onSubmit={submit} submitLabel="Save opening stock"
          summary={<>{L.lines.length} line{plural(L.lines.length)} · {units.toLocaleString("en-IN")} unit{plural(units)} seeded{value > 0 ? <> · {value.toLocaleString("en-IN")} value</> : null}</>} />
      )}
    </>
  );
}

/** Transfer — paired move between godowns. */
export function TransferPanel({ actionConfig, locations }: PanelProps) {
  const router = useRouter();
  const [fromId, setFromId] = useState(defaultLoc(locations));
  const [toId, setToId] = useState("");
  const [date, setDate] = useState(istTodayYmd());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const L = useTransferLines(actionConfig, fromId);
  const changeFrom = (v: string) => { L.reset(); setFromId(v); if (v === toId) setToId(""); };
  const units = L.lines.reduce((s, l) => s + (lineOk(l) ? Number(l.qty) : 0), 0);
  const anyShort = L.lines.some((l) => lineOk(l) && Number(l.qty) > (L.selectedLot(l)?.qtyUnits ?? 0));
  const canSubmit = Boolean(fromId && toId && fromId !== toId) && L.lines.some(lineOk) && !anyShort;
  const back = () => router.push("/stock");
  const toName = locations.find((l) => l.id === toId)?.name;

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      await postTransfer(actionConfig, {
        fromLocationId: fromId, toLocationId: toId, transferDate: date, note: null,
        lines: L.lines.filter(lineOk).map((l) => ({
          productId: l.productId, packSizeLitres: l.packSizeLitres, brand: l.brand, qtyUnits: Number(l.qty), fromBatchId: l.fromBatchId,
          destRackNo: l.destRack.trim() || null, destShelfNo: l.destShelf.trim() || null, destBinNo: l.destBin.trim() || null,
        })),
      });
      back();
    } catch (e) { setError(errorMessage(e, "Could not transfer stock.")); setBusy(false); }
  };

  return (
    <>
      <Section title="Route" sub="from → to">
        <div className="grid gap-3 sm:grid-cols-3">
          <LocationSelect locations={locations} value={fromId} onChange={changeFrom} label="From godown" required />
          <LocationSelect locations={locations.filter((l) => l.id !== fromId)} value={toId} onChange={setToId} label="To godown" required />
          <DateCell value={date} onChange={setDate} label="Transfer date" required />
        </div>
      </Section>
      <Section title="Items" sub={itemsSub(L.lines.length, units)}>
        <div className="flex flex-col gap-3">
          <SkuPicker actionConfig={actionConfig} onPick={(sku) => void L.add(sku)} excludeKeys={new Set()} disabled={!fromId} disabledHint="Pick the source godown first, then search a product." />
          <TransferGrid L={L} />
          <p className="text-[11px] text-muted-foreground">Pick a batch per line (soonest expiry first); its expiry &amp; shelf location travel to the destination. Add the same product again to move a second batch.</p>
        </div>
      </Section>
      {L.lines.length > 0 && (
        <ActionBar onCancel={back} busy={busy} error={error} canSubmit={canSubmit} onSubmit={submit} submitLabel="Transfer stock"
          summary={<>{L.lines.length} line{plural(L.lines.length)} · {units.toLocaleString("en-IN")} unit{plural(units)} moving{toName ? ` → ${toName}` : ""}</>} />
      )}
    </>
  );
}

/** Adjustment — signed delta per line. */
export function AdjustPanel({ actionConfig, locations }: PanelProps) {
  const router = useRouter();
  const [locationId, setLocationId] = useState(defaultLoc(locations));
  const [reason, setReason] = useState("damage");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(istTodayYmd());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const L = useAdjustLines(actionConfig, locationId);
  const changeLocation = (v: string) => { L.reset(); setLocationId(v); };
  const lineReady = (l: AdjustLine) => adjLineOk(l, L.selectedLot(l)?.qtyUnits ?? 0);
  const net = L.lines.reduce((s, l) => s + (adjSign(l) !== 0 ? Number(l.delta) : 0), 0);
  const active = L.lines.filter((l) => adjSign(l) !== 0);
  const canSubmit = Boolean(locationId) && active.length > 0 && active.every(lineReady);
  const back = () => router.push("/stock");

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      await postAdjustment(actionConfig, {
        locationId, reason, note: note.trim() || null, adjustmentDate: date,
        lines: active.map((l) => {
          const delta = Number(l.delta);
          return delta < 0
            ? { productId: l.productId, packSizeLitres: l.packSizeLitres, brand: l.brand, deltaUnits: delta, batchId: l.batchId }
            : { productId: l.productId, packSizeLitres: l.packSizeLitres, brand: l.brand, deltaUnits: delta, batchNumber: l.batchNumber.trim(), expiryDate: l.expiry, rackNo: l.rack.trim() || null, shelfNo: l.shelf.trim() || null, binNo: l.bin.trim() || null };
        }),
      });
      back();
    } catch (e) { setError(errorMessage(e, "Could not post the adjustment.")); setBusy(false); }
  };

  return (
    <>
      <Section title="Adjustment" sub="where & why">
        <div className="grid gap-3 sm:grid-cols-3">
          <LocationSelect locations={locations} value={locationId} onChange={changeLocation} required />
          <DateCell value={date} onChange={setDate} label="Adjustment date" required />
          <Field label="Reason" required>
            <SearchSelect items={REASONS.map(([value, label]) => ({ value, label }))} valueKey={reason} getKey={(r) => r.value} getLabel={(r) => r.label} onSelect={(v) => setReason(v || "damage")} placeholder="Select a reason" searchPlaceholder="Search reason…" emptyText="No reasons found" contentClassName="w-[280px] p-0" />
          </Field>
          <div className="sm:col-span-3"><Field label="Note" hint="optional"><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Shows on the ledger" /></Field></div>
        </div>
      </Section>
      <Section title="Items" sub={itemsSub(L.lines.length)}>
        <div className="flex flex-col gap-3">
          <SkuPicker actionConfig={actionConfig} onPick={(sku) => void L.add(sku)} excludeKeys={new Set()} disabled={!locationId} disabledHint="Pick the godown first, then search a product." />
          <AdjustGrid L={L} />
          <p className="text-[11px] text-muted-foreground">Enter a negative change to reduce a specific batch (damage/write-off), or a positive change to add a corrective batch (needs a batch no &amp; expiry).</p>
        </div>
      </Section>
      {L.lines.length > 0 && (
        <ActionBar onCancel={back} busy={busy} error={error} canSubmit={canSubmit} onSubmit={submit} submitLabel="Post adjustment"
          summary={<>{L.lines.length} line{plural(L.lines.length)} · net {net > 0 ? "+" : ""}{net.toLocaleString("en-IN")} unit{plural(Math.abs(net))}</>} />
      )}
    </>
  );
}
