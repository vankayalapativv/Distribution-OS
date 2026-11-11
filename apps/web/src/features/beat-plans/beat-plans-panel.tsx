"use client";

/**
 * "Beat Plans" board: pick a sales executive, then drag their customers across a
 * recurring Mon–Sat beat (plus an Unassigned pool). Order within a day is the
 * visit sequence. All positioning persists via the batched /beat-plans/reorder.
 */
import { withQueryClient } from "@/components/data-table/query-provider";
import { type ActionConfig } from "@/lib/api-client";
import { SearchSelect } from "@/features/orders/search-select";
import { BeatBoardSkeleton } from "./beat-board-skeleton";
import { BeatKanban } from "./beat-kanban";
import { BeatStats } from "./beat-stats";
import { useBeatPlans } from "./use-beat-plans";
import type { BeatExecutive } from "./beat-plans-api";

function BeatPlansPanelInner({ actionConfig }: { readonly actionConfig: ActionConfig }) {
  const b = useBeatPlans(actionConfig);

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-[240px]">
          <SearchSelect<BeatExecutive>
            items={b.executives}
            valueKey={b.executiveId}
            getKey={(ex) => ex.id}
            getLabel={(ex) => ex.name}
            onSelect={b.selectExecutive}
            placeholder="Select executive"
            searchPlaceholder="Search executive…"
            emptyText="No executives"
            contentClassName="w-[240px] p-0"
          />
        </div>
        <BeatStats customers={b.customers} />
      </div>

      {(() => { if (b.isError) return (
        <p className="py-10 text-center text-sm text-muted-foreground">Couldn&apos;t load this beat plan.</p>
      ); if (b.switching) return (
        <BeatBoardSkeleton />
      ); if (b.noExecutives) return (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 py-10 text-center">
          <p className="text-sm font-medium text-foreground">No beat plans yet</p>
          <p className="text-sm text-muted-foreground">
            Add a sales executive first, then plan their Monday–Saturday visit route here.
          </p>
        </div>
      ); return (
        <BeatKanban
          customers={b.customers}
          disabled={b.assignMut.isPending}
          callbacks={{
            onReorderDay: (weekday, customerIds) => b.reorderMut.mutate({ weekday, customerIds }),
            onUnassign: (customerId) => b.removeMut.mutate(customerId),
          }}
          onAssign={(customerId, weekday) => b.assignMut.mutate({ customerId, weekday })}
          onRemove={(customerId) => b.removeMut.mutate(customerId)}
        />
      ); })()}
    </section>
  );
}

export const BeatPlansPanel = withQueryClient(BeatPlansPanelInner);
