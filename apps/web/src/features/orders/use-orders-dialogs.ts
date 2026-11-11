"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiGet, apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import { mapFetchedToEditable, type FetchedOrderForEdit } from "./orders-list-helpers";
import type { EditableOrder } from "./use-order-draft";
import type { Order } from "./orders-api";

/** Owns all order-list dialog state + the async open/cancel handlers, so the list
 *  component stays a thin layout. The row-action menu and New-Order button call
 *  the returned openers; the dialog components render from the returned state. */
export function useOrdersDialogs(actionConfig: ActionConfig) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<EditableOrder | null>(null);
  const [canceling, setCanceling] = useState<Order | null>(null);
  const [cancelNote, setCancelNote] = useState("");
  const [generatedMsg, setGeneratedMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["orders"] });

  /** Load an order's detail and open the edit dialog seeded from it. */
  async function openEdit(row: Order) {
    setActionError(null);
    try {
      const { order } = await apiGet<{ order: FetchedOrderForEdit }>(actionConfig, `/orders/${row.id}`);
      setEditingOrder(mapFetchedToEditable(order));
      setEditOpen(true);
    } catch (e) {
      setActionError(errorMessage(e, "Could not load the order for editing."));
    }
  }

  /** Cancel (or short-close) the order; rethrows so ConfirmDialog shows the error. */
  async function doCancel(row: Order) {
    try {
      const note = cancelNote.trim();
      await apiRequest(actionConfig, "POST", `/orders/${row.id}/cancel`, { note: note === "" ? null : note });
      invalidate();
    } catch (e) {
      const message = errorMessage(e, "Could not cancel the order.");
      setActionError(message);
      throw new Error(message);
    }
  }

  return {
    createOpen, setCreateOpen, editOpen, setEditOpen, editingOrder, setEditingOrder,
    canceling, setCanceling, cancelNote, setCancelNote,
    generatedMsg, setGeneratedMsg, actionError,
    invalidate, openEdit, doCancel,
  };
}

export type OrdersDialogs = ReturnType<typeof useOrdersDialogs>;
