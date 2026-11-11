"use client";

import { type SyntheticEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import type { Expenditure } from "./expenditures-api";

export interface FormState {
  expenditureDate: string;
  categoryId: string;
  amount: string;
  paymentMode: string;
  paidTo: string;
  userId: string;
  remarks: string;
}

const EMPTY: FormState = {
  expenditureDate: "", categoryId: "", amount: "", paymentMode: "", paidTo: "", userId: "", remarks: "",
};

/** Record/edit-expenditure form state + the save (entry then optional bill upload). */
export function useExpenditureForm(actionConfig: ActionConfig, open: boolean, editing: Expenditure | null, onOpenChange: (open: boolean) => void) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [bill, setBill] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Idempotency key for a NEW entry: generated once when the dialog opens and
  // reused across retries of the same save, so a double-click / network retry
  // can't create a duplicate expenditure.
  const [clientUuid, setClientUuid] = useState<string>("");

  // Seed the form whenever the dialog opens (new entry vs editing one), using the
  // React "adjust state on change" pattern (keyed on the open target).
  const key = open ? (editing?.id ?? "new") : null;
  const [prevKey, setPrevKey] = useState<string | null>(null);
  if (key !== prevKey) {
    setPrevKey(key);
    if (open) {
      setError(null);
      setBill(null);
      if (!editing) setClientUuid(crypto.randomUUID());
      setForm(editing
        ? {
            expenditureDate: editing.expenditureDate, categoryId: editing.categoryId, amount: String(editing.amount),
            paymentMode: editing.paymentMode ?? "", paidTo: editing.paidTo ?? "", userId: editing.userId ?? "", remarks: editing.remarks ?? "",
          }
        : { ...EMPTY, expenditureDate: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) });
    }
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { expenditureDate: form.expenditureDate, categoryId: form.categoryId, amount: Number(form.amount) };
      if (form.paymentMode) payload.paymentMode = form.paymentMode;
      if (form.paidTo.trim()) payload.paidTo = form.paidTo.trim();
      if (form.userId) payload.userId = form.userId;
      if (form.remarks.trim()) payload.remarks = form.remarks.trim();

      const saved = editing
        ? await apiRequest<Expenditure>(actionConfig, "PATCH", `/expenditures/${editing.id}`, payload)
        : await apiRequest<Expenditure>(actionConfig, "POST", "/expenditures", {
            ...payload,
            clientUuid,
          });

      // The entry is persisted — refresh the list + summary NOW, before the
      // optional bill upload, so the entry is visible even if the upload fails
      // (otherwise a failed upload threw before this ran, hiding the saved entry
      // and inviting a duplicate re-entry).
      void queryClient.invalidateQueries({ queryKey: ["expenditures"] });
      void queryClient.invalidateQueries({ queryKey: ["expenditure-summary"] });

      if (bill) {
        const body = new FormData();
        body.append("file", bill);
        const res = await fetch(`${actionConfig.apiBaseUrl}/expenditures/${saved.id}/bill`, {
          method: "POST", headers: { Authorization: `Bearer ${actionConfig.authToken}` }, body,
        });
        if (!res.ok) throw new Error("Entry saved, but the bill upload failed — re-open the entry to attach it.");
      }

      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, "Failed to save the expenditure."));
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = form.expenditureDate !== "" && form.categoryId !== "" && Number(form.amount) > 0;
  return { form, set, bill, setBill, busy, error, handleSubmit, canSubmit };
}
