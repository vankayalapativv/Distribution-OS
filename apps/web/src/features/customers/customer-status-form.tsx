"use client";

import { type SyntheticEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SearchSelect } from "@/components/ui/search-select";
import { apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import type { Customer } from "./customers-api";
import { onTypeChange } from "./customer-segment-picker";

export function StatusForm({
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
  const [status, setStatus] = useState(customer.status);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const updated = await apiRequest<Customer>(
        actionConfig,
        "PATCH",
        `/customers/${customer.id}/status`,
        { status },
      );
      onDone(updated);
    } catch (e) {
      setError(errorMessage(e, "Failed to update status."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <DialogHeader>
        <DialogTitle>Change status</DialogTitle>
      </DialogHeader>
      <DialogBody className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <Label>New Status</Label>
          <SearchSelect
            items={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
              { value: "suspended", label: "Suspended" },
            ]}
            valueKey={status}
            getKey={(s) => s.value}
            getLabel={(s) => s.label}
            onSelect={onTypeChange(setStatus)}
            placeholder="Select status"
            searchPlaceholder="Search…"
            emptyText="No match"
            contentClassName="w-[320px] p-0"
          />
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}
      </DialogBody>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Saving…" : "Update status"}
        </Button>
      </DialogFooter>
    </form>
  );
}
