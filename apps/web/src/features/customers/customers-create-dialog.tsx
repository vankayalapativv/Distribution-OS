"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { type ActionConfig } from "@/lib/api-client";
import { SearchSelect } from "@/features/orders/search-select";
import { CustomerFormFields } from "./customers-form-fields";
import { useCreateCustomer } from "./use-create-customer";

export function CustomerCreateDialog({
  open,
  onOpenChange,
  actionConfig,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly actionConfig: ActionConfig;
}) {
  const f = useCreateCustomer(actionConfig, onOpenChange);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) f.reset();
        onOpenChange(next);
      }}
    >
      <DialogContent size="lg">
        <form onSubmit={f.handleCreate} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>Add customer</DialogTitle>
            <DialogDescription>A retailer or workshop account.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-6">
            <div className="flex flex-col gap-1.5">
              <Label>
                Sales Executive <span className="text-destructive">*</span>
              </Label>
              <SearchSelect
                items={f.salesExecutives}
                valueKey={f.salesExecutiveId}
                getKey={(u) => u.id}
                getLabel={(u) => u.name}
                onSelect={f.setSalesExecutiveId}
                placeholder="Assign to a sales executive"
                searchPlaceholder="Search executives…"
                emptyText={f.seLoading ? "Loading…" : "No executives found"}
                contentClassName="w-[320px] p-0"
              />
            </div>
            <CustomerFormFields
              customerType={f.customerType}
              setCustomerType={f.setCustomerType}
              segments={f.segments}
              setSegments={f.setSegments}
            />
            {f.error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{f.error}</p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={f.isCreating || f.segments.length === 0 || !f.customerType || !f.salesExecutiveId}
            >
              {f.isCreating ? "Creating…" : "Create customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
