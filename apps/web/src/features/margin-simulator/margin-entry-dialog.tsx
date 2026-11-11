"use client";

import { type SyntheticEvent, Suspense, use, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage, type ActionConfig } from "@/lib/api-client";
import { computeMargin } from "./margin-calc";
import { createSim, updateSim } from "./margin-client";
import { inrLitre, inrPack, marginTone, numericInput } from "./margin-format";
import { MarginSearchSelect } from "./margin-search-select";
import type { MarginSim, OilProduct } from "./margin-api";
import { saveLabel } from "@/lib/format";

const num = (s: string) => (s === "" ? 0 : Number(s));

/** Initial form values: the edited scenario's fields, or blanks (+ expense default). */
function initialDraft(editing: MarginSim | null) {
  return {
    productId: editing?.productId ?? "",
    packSize: editing ? String(editing.packSize) : "",
    mrp: editing?.mrp == null ? "" : String(editing.mrp),
    dlp: editing ? String(editing.dlp) : "",
    expensePerLiter: editing ? String(editing.expensePerLiter) : "65",
    schemePerLiter: editing ? String(editing.schemePerLiter) : "",
    coupon: editing?.coupon == null ? "" : String(editing.coupon),
    mop: editing ? String(editing.mop) : "",
  };
}

/**
 * Add / edit a saved margin scenario. The oil catalogue arrives as a promise and
 * is resolved with `use()` inside the form, which only mounts when the dialog is
 * open — so the page never blocks on the product list just to render this button.
 */
export function MarginEntryDialog({
  open,
  onOpenChange,
  productsPromise,
  editing,
  actionConfig,
  onDone,
}: {
  readonly open: boolean;
  readonly onOpenChange: (o: boolean) => void;
  readonly productsPromise: Promise<OilProduct[]>;
  readonly editing: MarginSim | null;
  readonly actionConfig: ActionConfig;
  readonly onDone: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <Suspense fallback={<DialogLoading />}>
          <MarginEntryForm
            productsPromise={productsPromise}
            editing={editing}
            actionConfig={actionConfig}
            onDone={onDone}
            onOpenChange={onOpenChange}
          />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}

function DialogLoading() {
  return (
    <>
      <DialogHeader>
        <DialogTitle>New margin simulation</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <p className="py-10 text-center text-sm text-muted-foreground">Loading products…</p>
      </DialogBody>
    </>
  );
}

function MarginEntryForm({
  productsPromise,
  editing,
  actionConfig,
  onDone,
  onOpenChange,
}: {
  readonly productsPromise: Promise<OilProduct[]>;
  readonly editing: MarginSim | null;
  readonly actionConfig: ActionConfig;
  readonly onDone: () => void;
  readonly onOpenChange: (o: boolean) => void;
}) {
  const products = use(productsPromise);
  const init = initialDraft(editing);
  const [productId, setProductId] = useState(init.productId);
  const [packSize, setPackSize] = useState(init.packSize);
  const [mrp, setMrp] = useState(init.mrp);
  const [dlp, setDlp] = useState(init.dlp);
  const [expensePerLiter, setExpense] = useState(init.expensePerLiter);
  const [schemePerLiter, setScheme] = useState(init.schemePerLiter);
  const [coupon, setCoupon] = useState(init.coupon);
  const [mop, setMop] = useState(init.mop);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const product = products.find((p) => p.id === productId);
  const packs = product?.packs ?? [];

  function onPickProduct(id: string) {
    setProductId(id);
    setPackSize("");
    setMrp("");
  }
  function onPickPack(size: string) {
    setPackSize(size); // MRP/DLP/MOP are entered by the client below (no catalogue price master)
  }

  const preview = computeMargin({
    packSize: num(packSize),
    dlp: num(dlp),
    expensePerLiter: num(expensePerLiter),
    mop: num(mop),
    schemePerLiter: num(schemePerLiter),
  });
  const canPreview = num(packSize) > 0;

  async function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!product) return setError("Pick a product.");
    if (!(num(packSize) > 0)) return setError("Pick a pack size.");
    const body = {
      productId: product.id,
      productName: product.productName,
      packSize: num(packSize),
      mrp: mrp === "" ? null : num(mrp),
      dlp: num(dlp),
      expensePerLiter: num(expensePerLiter),
      schemePerLiter: num(schemePerLiter),
      coupon: coupon === "" ? null : num(coupon),
      mop: num(mop),
    };
    setBusy(true);
    setError(null);
    try {
      if (editing) await updateSim(actionConfig, editing.id, body);
      else await createSim(actionConfig, body);
      onDone();
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, "Failed to save."));
    } finally {
      setBusy(false);
    }
  }

  const field = (label: string, value: string, set: (v: string) => void, ph: string) => (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => set(numericInput(e.target.value))} inputMode="decimal" placeholder={ph} />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <DialogHeader>
        <DialogTitle>{editing ? "Edit simulation" : "New margin simulation"}</DialogTitle>
      </DialogHeader>
      <DialogBody className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Product *</Label>
            <MarginSearchSelect
              items={products.map((p) => ({ value: p.id, label: p.productName }))}
              value={productId}
              onSelect={onPickProduct}
              placeholder="Search oils…"
              searchPlaceholder="Search oil name…"
              emptyText="No oils found"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Pack size (L) *</Label>
            <MarginSearchSelect
              items={packs.map((k) => ({ value: String(k.packSize), label: `${k.packSize} L` }))}
              value={packSize}
              onSelect={onPickPack}
              placeholder={product ? "Select pack…" : "Pick product first"}
              searchPlaceholder="Search pack…"
              emptyText="No packs"
              disabled={!product}
              contentClassName="w-[220px] p-0"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field("MRP (reference)", mrp, setMrp, "auto from catalogue")}
          {field("DLP — landing price *", dlp, setDlp, "per pack")}
          {field("Expense / L *", expensePerLiter, setExpense, "e.g. 65")}
          {field("Scheme / L *", schemePerLiter, setScheme, "e.g. 70")}
          {field("Coupon (reference)", coupon, setCoupon, "optional")}
          {field("MOP — market op. price *", mop, setMop, "per pack")}
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-accent/40 p-3">
          <div>
            <p className="text-xs text-muted-foreground">Net Margin / Pack</p>
            <p className={`text-lg font-semibold ${canPreview ? marginTone(preview.marginPerLiter) : "text-muted-foreground"}`}>
              {canPreview ? inrPack(preview.marginPerPack) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Net Margin / Liter</p>
            <p className={`text-lg font-semibold ${canPreview ? marginTone(preview.marginPerLiter) : "text-muted-foreground"}`}>
              {canPreview ? inrLitre(preview.marginPerLiter) : "—"}
            </p>
          </div>
        </div>

        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button type="submit" disabled={busy}>{saveLabel(busy, editing, "Save simulation")}</Button>
      </DialogFooter>
    </form>
  );
}
