"use client";

import { Fragment, type SyntheticEvent, useRef, useState } from "react";
import { CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogSection,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { type ActionConfig } from "@/lib/api-client";
import { BrandField } from "./brand-field";
import { ChipToggle, PRODUCT_SEGMENTS } from "./chip-toggle";
import { FieldError, fieldErrorProps } from "./field-error";
import { PackRows } from "./pack-rows";
import { FIELD_STEP, type ProductField, type useProductForm } from "./use-product-form";

type ProductForm = ReturnType<typeof useProductForm>;

/** The three guided steps, in order. */
const STEPS = ["Details", "Classification", "Pack sizes"] as const;

/** Horizontal progress rail: a numbered dot + label per step, a rule between. */
function StepRail({ step }: { readonly step: number }) {
  return (
    <div className="flex flex-none items-center border-b border-border px-6 py-3.5" aria-hidden="true">
      {STEPS.map((label, i) => (
        <Fragment key={label}>
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "grid size-7 flex-none place-items-center rounded-full border-[1.5px] text-xs font-semibold transition-colors",
                i < step && "border-primary bg-primary text-primary-foreground",
                i === step && "border-primary bg-primary/10 text-primary",
                i > step && "border-border bg-muted text-muted-foreground",
              )}
            >
              {i < step ? <CheckIcon className="size-3.5" /> : i + 1}
            </div>
            <span
              className={cn(
                "hidden whitespace-nowrap text-xs font-medium sm:inline",
                i <= step ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={cn("mx-3 h-px flex-1 rounded", i < step ? "bg-primary" : "bg-border")} />
          )}
        </Fragment>
      ))}
    </div>
  );
}

/**
 * Guided (3-step) "Add product" flow — Details → Classification → Pack sizes.
 * Shares all state, live validation and the save request with the single-page
 * Edit form via one `useProductForm` instance; this component owns the step cursor
 * and reacts to validation by jumping to + focusing the offending field.
 */
export function AddProductWizard({
  f,
  onOpenChange,
  actionConfig,
}: {
  readonly f: ProductForm;
  readonly onOpenChange: (open: boolean) => void;
  readonly actionConfig: ActionConfig;
}) {
  const [step, setStep] = useState(0);
  const last = STEPS.length - 1;

  const nameRef = useRef<HTMLInputElement>(null);
  const hsnRef = useRef<HTMLInputElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const segmentsRef = useRef<HTMLDivElement>(null);
  const packsRef = useRef<HTMLDivElement>(null);

  const err = f.fieldErrors;
  const shows = (field: ProductField) => Boolean(f.touched[field] && err[field]);

  /** Put the cursor on the offending field, jumping to its step first. */
  function focusField(field: ProductField) {
    requestAnimationFrame(() => {
      if (field === "name") nameRef.current?.focus();
      else if (field === "hsnCode") hsnRef.current?.focus();
      else if (field === "brand") brandRef.current?.querySelector<HTMLElement>("button")?.focus();
      else if (field === "segments") segmentsRef.current?.focus();
      else if (field === "packs") packsRef.current?.focus();
    });
  }

  function jumpToField(field: ProductField) {
    f.touch(field);
    setStep(FIELD_STEP[field]);
    focusField(field);
  }

  function goNext() {
    if (!f.isStepValid(step)) {
      // Reached only via Enter (the button is disabled while invalid): reveal the
      // step's errors and focus the first one.
      let stepFields: ProductField[] = ["packs"];
      if (step === 0) stepFields = ["name", "brand", "hsnCode"];
      else if (step === 1) stepFields = ["segments"];
      stepFields.forEach((k) => f.touch(k));
      const firstBad = stepFields.find((k) => err[k]);
      if (firstBad) focusField(firstBad);
      return;
    }
    setStep((s) => Math.min(last, s + 1));
  }

  function goBack() {
    setStep((s) => Math.max(0, s - 1));
  }

  async function onSubmit(e: SyntheticEvent<HTMLFormElement>) {
    if (step < last) {
      e.preventDefault();
      goNext();
      return;
    }
    const result = await f.handleSubmit(e);
    if (!result.ok && result.field) jumpToField(result.field);
  }

  return (
    <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
      <DialogHeader>
        <DialogTitle>Add product</DialogTitle>
        <DialogDescription>Three quick steps — details, classification, then pack sizes.</DialogDescription>
      </DialogHeader>

      <StepRail step={step} />

      <DialogBody className="space-y-5">
        {/* Step 1 — Details */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label>Product Name <span className="text-destructive">*</span></Label>
              <Input
                ref={nameRef}
                value={f.productName}
                onChange={(e) => {
                  f.setProductName(e.target.value);
                  f.touch("name");
                }}
                onBlur={() => f.touch("name")}
                placeholder="e.g. Fuchs 10W-40"
                autoFocus
                {...fieldErrorProps("err-name", shows("name"), err.name)}
              />
              <FieldError id="err-name" show={shows("name")} message={err.name} />
            </div>

            <div ref={brandRef} className="flex flex-col gap-1.5">
              <BrandField
                category="oils"
                value={f.brand}
                onChange={(v) => {
                  f.setBrand(v);
                  f.touch("brand");
                }}
                actionConfig={actionConfig}
              />
              <FieldError id="err-brand" show={shows("brand")} message={err.brand} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>HSN Code <span className="text-destructive">*</span></Label>
              <Input
                ref={hsnRef}
                value={f.hsnCode}
                onChange={(e) => {
                  f.setHsnCode(e.target.value.replace(/[^\d]/g, ""));
                  f.touch("hsnCode");
                }}
                onBlur={() => f.touch("hsnCode")}
                inputMode="numeric"
                maxLength={8}
                placeholder="e.g. 27101980"
                {...fieldErrorProps("err-hsn", shows("hsnCode"), err.hsnCode)}
              />
              <FieldError id="err-hsn" show={shows("hsnCode")} message={err.hsnCode} />
            </div>
          </div>
        )}

        {/* Step 2 — Classification */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label>Sold by <span className="text-destructive">*</span></Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => f.setUnit("litres")}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                    f.unit === "litres"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background text-foreground hover:bg-accent",
                  )}
                >
                  Litres (pack sizes)
                </button>
                <button
                  type="button"
                  onClick={() => f.setUnit("quantity")}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                    f.unit === "quantity"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background text-foreground hover:bg-accent",
                  )}
                >
                  Quantity (pieces)
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {f.unit === "litres"
                  ? "Oils & lubricants — the executive picks a pack size, then a count."
                  : "Sold by the piece — no pack sizes; the executive just enters a count."}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Segment <span className="text-destructive">*</span> (pick all that apply)</Label>
              <div
                ref={segmentsRef}
                role="group"
                aria-label="Segment"
                tabIndex={-1}
                className="flex flex-wrap gap-2 outline-none"
                {...fieldErrorProps("err-seg", shows("segments"), err.segments)}
              >
                {PRODUCT_SEGMENTS.map((s) => (
                  <ChipToggle key={s} label={s} on={f.segments.includes(s)} onClick={() => f.toggleSegment(s)} />
                ))}
              </div>
              <FieldError id="err-seg" show={shows("segments")} message={err.segments} />
            </div>
          </div>
        )}

        {/* Step 3 — Pack sizes (with a review of the earlier steps) */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="space-y-2.5 rounded-lg border border-border bg-muted/40 px-4 py-3">
              <div className="flex items-baseline gap-3 text-sm">
                <span className="w-20 flex-none text-muted-foreground">Product</span>
                <span className="min-w-0 flex-1 font-medium">
                  {f.productName || "—"}
                  {f.brand ? ` · ${f.brand}` : ""}
                  {f.hsnCode ? ` · HSN ${f.hsnCode}` : ""}
                </span>
                <button type="button" onClick={() => setStep(0)} className="flex-none text-xs font-semibold text-primary hover:underline">
                  Edit
                </button>
              </div>
              <div className="flex items-baseline gap-3 text-sm">
                <span className="w-20 flex-none text-muted-foreground">Segments</span>
                <span className="min-w-0 flex-1 font-medium">{f.segments.join(", ") || "—"}</span>
                <button type="button" onClick={() => setStep(1)} className="flex-none text-xs font-semibold text-primary hover:underline">
                  Edit
                </button>
              </div>
            </div>

            {f.unit === "litres" ? (
              <DialogSection label="Pack sizes">
                <div ref={packsRef} tabIndex={-1} className="outline-none">
                  <PackRows packs={f.packs} onChange={(p) => { f.setPacks(p); f.touch("packs"); }} />
                </div>
                <FieldError id="err-packs" show={shows("packs")} message={err.packs} />
              </DialogSection>
            ) : (
              <div className="rounded-lg border border-dashed border-input bg-muted/40 px-4 py-5 text-center text-sm text-muted-foreground">
                Sold <span className="font-medium text-foreground">by the piece</span> — no pack sizes. The executive just enters a count.
              </div>
            )}
          </div>
        )}

        {f.error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{f.error}</p>
        )}
      </DialogBody>

      <DialogFooter className="sm:justify-between">
        {step > 0 ? (
          <Button type="button" variant="outline" onClick={goBack}>
            Back
          </Button>
        ) : (
          <span className="hidden sm:block" />
        )}
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {step < last ? (
            <Button type="button" onClick={goNext} disabled={!f.isStepValid(step)}>
              Continue
            </Button>
          ) : (
            <Button type="submit" disabled={f.busy || !f.allValid}>
              {f.busy ? "Saving…" : "Create product"}
            </Button>
          )}
        </div>
      </DialogFooter>
    </form>
  );
}
