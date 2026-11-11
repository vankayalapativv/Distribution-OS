"use client";

import { type SyntheticEvent, useState } from "react";
import { apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import type { CustomerDetailRole } from "./customer-detail";
import { canClearOpening, isLocked, todayIso, validateOpening, type OpeningBalance } from "./opening-balance-logic";

/** State + PUT/DELETE handlers for the opening-balance form. */
export function useOpeningForm({
  customerId,
  role,
  actionConfig,
  initial,
  onDone,
}: {
  customerId: string;
  role: CustomerDetailRole;
  actionConfig: ActionConfig;
  initial: OpeningBalance | null;
  onDone: () => void;
}) {
  const [asOfDate, setAsOfDate] = useState(initial?.asOfDate ?? todayIso());
  const [amount, setAmount] = useState(initial ? String(initial.openingAmount) : "");
  const [remarks, setRemarks] = useState(initial?.remarks ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locked = isLocked(initial, role);
  const canClear = canClearOpening(initial, role);
  const base = `/customers/${customerId}/opening-balance`;

  async function run(fn: () => Promise<unknown>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onDone();
    } catch (e) {
      setError(errorMessage(e, fallback));
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked) return;
    const result = validateOpening(amount, asOfDate);
    if ("error" in result) return setError(result.error);
    await run(
      () => apiRequest(actionConfig, "PUT", base, { asOfDate, openingAmount: result.value, remarks: remarks.trim() || null }),
      "Couldn't save the opening balance.",
    );
  }

  async function handleClear() {
    if (!canClear) return;
    await run(() => apiRequest(actionConfig, "DELETE", base), "Couldn't clear the opening balance.");
  }

  return {
    asOfDate, setAsOfDate, amount, setAmount, remarks, setRemarks,
    busy, error, locked, canClear, handleSubmit, handleClear,
  };
}
