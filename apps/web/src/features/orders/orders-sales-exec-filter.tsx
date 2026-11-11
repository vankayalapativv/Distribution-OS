"use client";

import { Users } from "lucide-react";
import { Label } from "@/components/ui/label";
import { SearchSelect } from "./search-select";
import { initials } from "./order-se-initials";
import type { SalesExecutive } from "./orders-api";

/** Small circular initials avatar shown beside an executive's name. */
function SEAvatar({ name }: { readonly name: string }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
      {initials(name)}
    </span>
  );
}

/** The Sales-Executive searchable filter (avatars in options + trigger). Hidden
 *  by the caller when there are no executives. */
export function OrdersSalesExecFilter({
  salesExecutiveId,
  onSalesExecChange,
  salesExecutives,
}: {
  readonly salesExecutiveId: string;
  readonly onSalesExecChange: (value: string) => void;
  readonly salesExecutives: SalesExecutive[];
}) {
  return (
    <div className="w-[190px]">
      <Label className="text-xs text-muted-foreground mb-1.5 block">Sales Executive</Label>
      <SearchSelect
        items={[{ id: "", name: "All executives" }, ...salesExecutives]}
        valueKey={salesExecutiveId}
        getKey={(x) => x.id}
        getLabel={(x) => x.name}
        onSelect={onSalesExecChange}
        placeholder="All executives"
        searchPlaceholder="Search executive…"
        emptyText="No executives found"
        contentClassName="w-[240px] p-0"
        renderOption={(x) =>
          x.id === "" ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-dashed border-border">
                <Users size={12} className="opacity-60" />
              </span>
              All executives
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <SEAvatar name={x.name} />
              <span className="truncate">{x.name}</span>
            </span>
          )
        }
        renderTrigger={(selected) =>
          selected && selected.id ? (
            <span className="flex min-w-0 items-center gap-2">
              <SEAvatar name={selected.name} />
              <span className="truncate text-foreground">{selected.name}</span>
            </span>
          ) : (
            <span className="truncate text-muted-foreground">All executives</span>
          )
        }
      />
    </div>
  );
}
