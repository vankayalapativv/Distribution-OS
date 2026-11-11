"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogSection,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type ActionConfig } from "@/lib/api-client";
import type { Expenditure, ExpenditureCategory } from "./expenditures-api";
import { ExpenditureFormSpend } from "./expenditure-form-spend";
import { ExpenditureFormDetails } from "./expenditure-form-details";
import { useExpenditureForm } from "./use-expenditure-form";
import { saveLabel } from "@/lib/format";

/**
 * Record or edit one expenditure. The bill is uploaded as a second step after
 * the entry exists (the upload endpoint keys off the entry id).
 */
export function ExpenditureFormDialog({
  open,
  onOpenChange,
  categories,
  people,
  editing,
  actionConfig,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly categories: ExpenditureCategory[];
  readonly people: { id: string; name: string }[];
  readonly editing: Expenditure | null;
  readonly actionConfig: ActionConfig;
}) {
  const f = useExpenditureForm(actionConfig, open, editing, onOpenChange);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form onSubmit={f.handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit expenditure" : "Record expenditure"}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-6">
            <ExpenditureFormSpend form={f.form} set={f.set} categories={categories} />
            <ExpenditureFormDetails form={f.form} set={f.set} people={people} />

            <DialogSection label="Attachment & notes">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="exp-bill">Bill / receipt</Label>
                  <Input
                    id="exp-bill"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(e) => f.setBill(e.target.files?.[0] ?? null)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional — image or PDF, up to 10 MB.
                    {editing?.hasBill && !f.bill ? " A bill is already attached." : ""}
                  </p>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="exp-remarks">Remarks</Label>
                  <Input id="exp-remarks" value={f.form.remarks} onChange={(e) => f.set("remarks", e.target.value)} placeholder="Optional note" />
                </div>
              </div>
            </DialogSection>

            {f.error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{f.error}</p> : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!f.canSubmit || f.busy}>
              {saveLabel(f.busy, editing, "Record expenditure")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
