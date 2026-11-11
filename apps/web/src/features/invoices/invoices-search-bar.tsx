"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { InvoicesListState } from "./use-invoices-list";

/** Search box (submit-to-apply) + a Clear and a customer-filter chip. */
export function InvoicesSearchBar({ s }: { readonly s: InvoicesListState }) {
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        s.applySearch();
      }}
    >
      <Input
        className="max-w-xs bg-white"
        placeholder="Search invoice no, customer, phone…"
        value={s.qInput}
        onChange={(e) => s.setQInput(e.target.value)}
      />
      <Button type="submit" variant="outline">Search</Button>
      {s.applied ? (
        <Button type="button" variant="ghost" onClick={s.clearSearch}>Clear</Button>
      ) : null}
      {s.customerId ? (
        <button
          type="button"
          onClick={s.clearCustomer}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-accent px-3 text-sm text-foreground hover:bg-accent/70"
        >
          Customer: <span className="font-medium">{s.customerName ?? "selected"}</span>
          <X className="size-3.5 text-muted-foreground" />
        </button>
      ) : null}
    </form>
  );
}
