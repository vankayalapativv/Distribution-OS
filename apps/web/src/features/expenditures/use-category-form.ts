"use client";

import { type SyntheticEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import type { ExpenditureCategory, ExpenditureType } from "./expenditures-api";

/** Add-category form state + the create request. */
export function useCategoryForm(actionConfig: ActionConfig, onOpenChange: (open: boolean) => void) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState<ExpenditureType>("variable");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiRequest<ExpenditureCategory>(actionConfig, "POST", "/expenditures/categories", { name: name.trim(), type });
      void queryClient.invalidateQueries({ queryKey: ["expenditure-categories"] });
      setName("");
      setType("variable");
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, "Failed to add the category."));
    } finally {
      setBusy(false);
    }
  }

  return { name, setName, type, setType, busy, error, handleSubmit };
}
