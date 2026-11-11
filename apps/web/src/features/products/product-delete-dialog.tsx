"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import type { ManagedProduct } from "./products-api";

export function ProductDeleteDialog({
  target,
  onOpenChange,
  actionConfig,
}: {
  readonly target: ManagedProduct | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly actionConfig: ActionConfig;
}) {
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!target) return;
    setIsDeleting(true);
    setError(null);
    try {
      await apiRequest(actionConfig, "DELETE", `/products/${target.id}`);
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, "Failed to delete product."));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(next) => {
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Delete product</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{" "}
            <span className="font-medium text-foreground">{target?.productName}</span>? This
            cannot be undone.
          </p>
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
