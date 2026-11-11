"use client";

import { type Dispatch, type SetStateAction } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect } from "@/components/ui/search-select";
import { CATEGORY_LABELS } from "./market-intelligence-notes";

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }));

export interface ItemDraft {
  /** Stable client id for React keys (draft rows have no server id). */
  uid: string;
  category: string;
  competitorBrand: string;
  product: string;
  price: string;
  details: string;
}

export function emptyItem(): ItemDraft {
  return { uid: crypto.randomUUID(), category: "pricing", competitorBrand: "", product: "", price: "", details: "" };
}

/** The structured "intelligence items" editor rows inside the note dialog. */
export function IntelligenceItems({
  items,
  setItems,
}: {
  readonly items: ItemDraft[];
  readonly setItems: Dispatch<SetStateAction<ItemDraft[]>>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label>Intelligence items</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setItems((prev) => [...prev, emptyItem()])}
        >
          <Plus size={13} className="mr-1" /> Add item
        </Button>
      </div>
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Optional: add structured rows for competitor pricing, promotions, stock…
        </p>
      )}
      {items.map((item, index) => (
        <div
          key={item.uid}
          className="grid grid-cols-[140px_1fr_1fr_90px_1.5fr_28px] items-center gap-2 rounded-md border border-border p-2"
        >
          <SearchSelect
            items={CATEGORY_OPTIONS}
            valueKey={item.category}
            getKey={(o) => o.value}
            getLabel={(o) => o.label}
            onSelect={(v) => {
              if (!v) return;
              setItems((prev) => prev.map((it, i) => (i === index ? { ...it, category: v } : it)));
            }}
            placeholder="Category"
            searchPlaceholder="Search…"
            emptyText="No match"
            triggerClassName="!h-8"
            contentClassName="w-[180px] p-0"
          />
          <Input
            value={item.competitorBrand}
            placeholder="Competitor"
            className="h-8"
            onChange={(e) =>
              setItems((prev) =>
                prev.map((it, i) => (i === index ? { ...it, competitorBrand: e.target.value } : it)),
              )
            }
          />
          <Input
            value={item.product}
            placeholder="Product"
            className="h-8"
            onChange={(e) =>
              setItems((prev) =>
                prev.map((it, i) => (i === index ? { ...it, product: e.target.value } : it)),
              )
            }
          />
          <Input
            value={item.price}
            placeholder="₹"
            type="number"
            className="h-8"
            onChange={(e) =>
              setItems((prev) =>
                prev.map((it, i) => (i === index ? { ...it, price: e.target.value } : it)),
              )
            }
          />
          <Input
            value={item.details}
            placeholder="Details"
            className="h-8"
            onChange={(e) =>
              setItems((prev) =>
                prev.map((it, i) => (i === index ? { ...it, details: e.target.value } : it)),
              )
            }
          />
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
