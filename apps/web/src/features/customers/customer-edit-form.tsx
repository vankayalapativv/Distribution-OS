"use client";

import { type SyntheticEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import { splitSegments } from "./customer-edit-fields";
import { CustomerEditFormFields } from "./customer-edit-form-fields";
import { buildEditPayload } from "./customer-edit-payload";
import type { Customer } from "./customers-api";

export function EditForm({
  customer,
  actionConfig,
  onDone,
  onCancel,
}: {
  readonly customer: Customer;
  readonly actionConfig: ActionConfig;
  readonly onDone: (customer: Customer) => void;
  readonly onCancel: () => void;
}) {
  const [customerType, setCustomerType] = useState(customer.customerType);
  const [segments, setSegments] = useState<string[]>(splitSegments(customer.segment));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    const fd = new FormData(event.currentTarget);
    try {
      const updated = await apiRequest<Customer>(
        actionConfig,
        "PATCH",
        `/customers/${customer.id}`,
        buildEditPayload(fd, { customerType, segments }),
      );
      onDone(updated);
    } catch (e) {
      setError(errorMessage(e, "Failed to update customer."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <DialogHeader>
        <DialogTitle>Edit customer</DialogTitle>
      </DialogHeader>
      <DialogBody className="space-y-6">
        <CustomerEditFormFields
          customer={customer}
          customerType={customerType}
          setCustomerType={setCustomerType}
          segments={segments}
          setSegments={setSegments}
        />
        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}
      </DialogBody>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}
