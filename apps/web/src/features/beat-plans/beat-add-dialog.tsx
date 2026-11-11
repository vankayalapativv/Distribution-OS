"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { matchesQuery, type BeatCustomer } from "./beat-plans-api";

/**
 * Add-to-day modal: search the executive's unassigned customers by name, trade
 * name, phone or city, then pick one. The pool is already only customers on NO
 * day, so a customer can never be added to two days (no duplicates).
 */
export function BeatAddDialog({
  open,
  onClose,
  dayLabel,
  pool,
  onAdd,
  disabled,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly dayLabel: string;
  readonly pool: BeatCustomer[];
  readonly onAdd: (customerId: string) => void;
  readonly disabled: boolean;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(
    () => pool.filter((c) => matchesQuery(c, query)).slice(0, 60),
    [pool, query],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setQuery("");
          onClose();
        }
      }}
    >
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Add to {dayLabel}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, phone or city…"
              className="pl-9"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {pool.length} unassigned · showing {results.length}
          </p>
          <div className="max-h-[340px] divide-y divide-border overflow-y-auto rounded-md border border-border">
            {results.length === 0 ? (
              <p className="px-3 py-10 text-center text-sm text-muted-foreground">
                No matching customers
              </p>
            ) : (
              results.map((c) => (
                <button
                  key={c.customerId}
                  type="button"
                  disabled={disabled}
                  onClick={() => onAdd(c.customerId)}
                  className="flex w-full flex-col items-start px-3 py-2.5 text-left transition-colors hover:bg-accent disabled:opacity-50"
                >
                  <span className="text-sm font-medium text-foreground">{c.legalName}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {[c.customerCode, c.city, c.phone].filter(Boolean).join(" · ")}
                  </span>
                </button>
              ))
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
