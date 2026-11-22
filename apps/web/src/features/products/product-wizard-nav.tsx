"use client";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";

/** The wizard's footer: Back (from step 2+), Cancel, and Continue / Create product. */
export function WizardNav({
  step, last, stepValid, busy, allValid, onBack, onNext, onCancel,
}: Readonly<{
  step: number; last: number; stepValid: boolean; busy: boolean; allValid: boolean;
  onBack: () => void; onNext: () => void; onCancel: () => void;
}>) {
  return (
    <DialogFooter className="sm:justify-between">
      {step > 0 ? (
        <Button type="button" variant="outline" onClick={onBack}>Back</Button>
      ) : (
        <span className="hidden sm:block" />
      )}
      <div className="flex flex-col-reverse gap-2.5 sm:flex-row">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        {step < last ? (
          <Button type="button" onClick={onNext} disabled={!stepValid}>Continue</Button>
        ) : (
          <Button type="submit" disabled={busy || !allValid}>{busy ? "Saving…" : "Create product"}</Button>
        )}
      </div>
    </DialogFooter>
  );
}
