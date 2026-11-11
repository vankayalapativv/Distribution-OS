"use client";

import { type SyntheticEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest, errorMessage } from "@/lib/api-client";
import type { Order } from "./orders-api";
import type { LockedLine, UseOrderDraftArgs } from "./order-draft-types";
import { seedLockedLines, seedOilLines } from "./order-draft-seed";
import { buildOrderPayload, collectDraftItems, validateDraft } from "./order-draft-submit";
import { useOilLines } from "./use-oil-lines";

export type { EditableOrder, LockedLine } from "./order-draft-types";

export function useOrderDraft({
  open,
  onOpenChange,
  products,
  actionConfig,
  order,
  initialCustomerId,
  onCreated,
}: UseOrderDraftArgs) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(order);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedSalesExecId, setSelectedSalesExecId] = useState("");
  const [orderDate, setOrderDate] = useState<Date | undefined>(undefined);
  const [orderDateOpen, setOrderDateOpen] = useState(false);

  const oil = useOilLines(open, order ? seedOilLines(order) : undefined);
  const [lockedLines, setLockedLines] = useState<LockedLine[]>([]);
  const isPartial = lockedLines.length > 0;
  const setLockedQty = (orderItemId: string, quantityUnits: string) =>
    setLockedLines((prev) => prev.map((l) => (l.orderItemId === orderItemId ? { ...l, quantityUnits } : l)));

  // Reset/seed the header each time the dialog opens; line hooks self-seed.
  const [prevOpen, setPrevOpen] = useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setCreateError(null);
      setSelectedCustomerId(order?.customerId ?? initialCustomerId ?? "");
      setSelectedSalesExecId(order?.salesExecutiveId ?? "");
      setOrderDate(order?.orderDate ? new Date(order.orderDate) : undefined);
      setOrderDateOpen(false);
      setLockedLines(order ? seedLockedLines(order) : []);
    }
  }

  function closeCreate() {
    setCreateError(null);
    onOpenChange(false);
  }

  async function handleCreate(event: SyntheticEvent) {
    event.preventDefault();
    setIsCreating(true);
    setCreateError(null);
    const picked = collectDraftItems(oil.lineItems, products);
    const err = validateDraft({ ...picked, lockedLines });
    if (err) {
      setCreateError(err);
      setIsCreating(false);
      return;
    }
    const payload = buildOrderPayload({ selectedCustomerId, selectedSalesExecId, orderDate, lockedLines, products, ...picked });
    try {
      await apiRequest<{ order: Order }>(
        actionConfig,
        order ? "PATCH" : "POST",
        order ? `/orders/${order.id}` : "/orders",
        payload,
      );
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      onCreated?.();
      closeCreate();
    } catch (error) {
      setCreateError(errorMessage(error, "Failed to save the order."));
    } finally {
      setIsCreating(false);
    }
  }

  return {
    isEdit, isPartial, lockedLines, setLockedQty, isCreating, createError,
    selectedCustomerId, setSelectedCustomerId, selectedSalesExecId, setSelectedSalesExecId,
    orderDate, setOrderDate, orderDateOpen, setOrderDateOpen,
    closeCreate, handleCreate, ...oil,
  };
}
