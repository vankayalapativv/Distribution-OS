"use client";

import { type SyntheticEvent, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import type { Customer } from "./customers-api";
import { buildCustomerPayload, validateCustomer } from "./customer-create-payload";

/** State + submit for the Add-customer dialog: the SE dropdown query, the
 *  controlled type/segment/executive fields, and the validated POST. */
export function useCreateCustomer(actionConfig: ActionConfig, onOpenChange: (open: boolean) => void) {
  const queryClient = useQueryClient();
  const [customerType, setCustomerType] = useState("");
  const [segments, setSegments] = useState<string[]>([]);
  const [salesExecutiveId, setSalesExecutiveId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seQuery = useQuery({
    queryKey: ["sales-executives"],
    queryFn: () =>
      apiGet<{ salesExecutives: { id: string; name: string }[] }>(actionConfig, "/orders/sales-executives"),
  });
  const salesExecutives = seQuery.data?.salesExecutives ?? [];

  function reset() {
    setCustomerType("");
    setSegments([]);
    setSalesExecutiveId("");
    setError(null);
  }

  async function handleCreate(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalid = validateCustomer({ customerType, segments, salesExecutiveId });
    if (invalid) return setError(invalid);
    setIsCreating(true);
    setError(null);
    const fd = new FormData(event.currentTarget);
    try {
      await apiRequest<Customer>(
        actionConfig,
        "POST",
        "/customers",
        buildCustomerPayload(fd, { customerType, segments, salesExecutiveId }),
      );
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
      reset();
      onOpenChange(false);
    } catch (e) {
      setError(errorMessage(e, "Failed to create customer."));
    } finally {
      setIsCreating(false);
    }
  }

  return {
    customerType, setCustomerType,
    segments, setSegments,
    salesExecutiveId, setSalesExecutiveId,
    isCreating, error,
    salesExecutives, seLoading: seQuery.isLoading,
    reset, handleCreate,
  };
}
