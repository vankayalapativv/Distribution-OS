"use client";

import { type SyntheticEvent, useState } from "react";
import { DialogBody, DialogDescription, DialogHeader, DialogSection, DialogTitle } from "@/components/ui/dialog";
import { type ActionConfig } from "@/lib/api-client";
import { ProductBrandFieldRow, ProductHsnField, ProductNameField } from "./product-core-fields";
import { ProductSegmentsField, ProductUnitToggle } from "./product-class-fields";
import { ProductPacksField } from "./product-packs-field";
import { StepRail, WIZARD_STEPS } from "./product-wizard-step-rail";
import { WizardReview } from "./product-wizard-review";
import { WizardNav } from "./product-wizard-nav";
import { useProductFieldRefs } from "./use-product-field-refs";
import { FIELD_STEP, type ProductField, type ProductForm } from "./use-product-form";

const STEP_KEYS: Record<number, ProductField[]> = { 0: ["name", "brand", "hsnCode"], 1: ["segments"], 2: ["packs"] };

/**
 * Guided (3-step) "Add product" flow — Details → Classification → Pack sizes.
 * Shares all state, validation, the save request and the field components with
 * the single-page Edit form; owns only the step cursor and jump-to-field logic.
 */
export function AddProductWizard({
  f, onOpenChange, actionConfig,
}: Readonly<{ f: ProductForm; onOpenChange: (open: boolean) => void; actionConfig: ActionConfig }>) {
  const [step, setStep] = useState(0);
  const last = WIZARD_STEPS.length - 1;
  const r = useProductFieldRefs();
  const err = f.fieldErrors;

  function jumpToField(field: ProductField) {
    f.touch(field);
    setStep(FIELD_STEP[field]);
    r.focusField(field);
  }

  function goNext() {
    if (!f.isStepValid(step)) {
      // Reached only via Enter (the button is disabled while invalid): reveal the
      // step's errors and focus the first one.
      const keys = STEP_KEYS[step];
      keys.forEach((k) => f.touch(k));
      const firstBad = keys.find((k) => err[k]);
      if (firstBad) r.focusField(firstBad);
      return;
    }
    setStep((s) => Math.min(last, s + 1));
  }
  const goBack = () => setStep((s) => Math.max(0, s - 1));

  async function onSubmit(e: SyntheticEvent<HTMLFormElement>) {
    if (step < last) { e.preventDefault(); goNext(); return; }
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
        {step === 0 && (
          <div className="space-y-4">
            <ProductNameField f={f} idPrefix="err" inputRef={r.nameRef} autoFocus />
            <ProductBrandFieldRow f={f} idPrefix="err" wrapRef={r.brandRef} actionConfig={actionConfig} />
            <ProductHsnField f={f} idPrefix="err" inputRef={r.hsnRef} />
          </div>
        )}
        {step === 1 && (
          <div className="space-y-4">
            <ProductUnitToggle f={f} />
            <ProductSegmentsField f={f} idPrefix="err" segmentsRef={r.segmentsRef} />
          </div>
        )}
        {step === 2 && (
          <div className="space-y-5">
            <WizardReview f={f} onEditStep={setStep} />
            <DialogSection label="Pack sizes">
              <ProductPacksField f={f} idPrefix="err" packsRef={r.packsRef} />
            </DialogSection>
          </div>
        )}
        {f.error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{f.error}</p>
        )}
      </DialogBody>
      <WizardNav
        step={step} last={last} stepValid={f.isStepValid(step)} busy={f.busy} allValid={f.allValid}
        onBack={goBack} onNext={goNext} onCancel={() => onOpenChange(false)}
      />
    </form>
  );
}
