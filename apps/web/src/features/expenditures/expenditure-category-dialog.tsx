"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect } from "@/features/orders/search-select";
import { type ActionConfig } from "@/lib/api-client";
import type { ExpenditureType } from "./expenditures-api";
import { useCategoryForm } from "./use-category-form";

const TYPE_OPTIONS = [
  { value: "compulsory", label: "Compulsory" },
  { value: "variable", label: "Variable" },
];

/** Add a custom expenditure category. Any office role may create one. */
export function ExpenditureCategoryDialog({
  open,
  onOpenChange,
  actionConfig,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly actionConfig: ActionConfig;
}) {
  const { name, setName, type, setType, busy, error, handleSubmit } = useCategoryForm(actionConfig, onOpenChange);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>Add category</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Name</Label>
              <Input
                id="cat-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Security Guard"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Type</Label>
              <SearchSelect
                items={TYPE_OPTIONS}
                valueKey={type}
                getKey={(o) => o.value}
                getLabel={(o) => o.label}
                onSelect={(v) => setType(v as ExpenditureType)}
                placeholder="Select type"
                searchPlaceholder="Search type…"
                emptyText="No type found"
                contentClassName="w-(--anchor-width) p-0"
              />
              <p className="text-xs text-muted-foreground">
                Compulsory = fixed monthly overhead. Variable = everything else.
              </p>
            </div>

            {error ? (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || busy}>
              {busy ? "Adding…" : "Add category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
