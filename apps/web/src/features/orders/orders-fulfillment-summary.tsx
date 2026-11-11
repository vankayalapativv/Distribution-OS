"use client";

import { Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet, type ActionConfig } from "@/lib/api-client";
import { GROUPS, type FulfillmentSummary } from "./order-fulfillment-summary-groups";
import { FulfillmentTile } from "./order-fulfillment-tile";

/** Order fulfillment breakdown for the Orders page. Grouped (In progress →
 *  Completed → Returns → Cancelled), stage-tinted, zero-count stages hidden.
 *  Clicking a tile filters the orders table to that stage (toggle to clear). */
export function OrdersFulfillmentSummary({
  actionConfig,
  active,
  onSelect,
}: {
  readonly actionConfig: ActionConfig;
  readonly active: string;
  readonly onSelect: (value: string) => void;
}) {
  const q = useQuery({
    queryKey: ["orders", "fulfillment-summary"],
    queryFn: () => apiGet<{ summary: FulfillmentSummary }>(actionConfig, "/orders/fulfillment-summary"),
  });
  const s = q.data?.summary;
  if (!s) return null;

  // Drop zero-count stages, then drop any group left with no stages.
  const groups = GROUPS.map((g) => ({
    title: g.title,
    stages: g.stages.filter((stage) => s[stage.key] > 0),
  })).filter((g) => g.stages.length > 0);

  return (
    <div className="flex flex-wrap items-stretch gap-x-5 gap-y-4">
      {groups.map((g, i) => (
        <Fragment key={g.title}>
          {i > 0 && <div className="hidden w-px self-stretch bg-border sm:block" />}
          <div>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {g.title}
            </p>
            <div className="flex flex-wrap gap-2">
              {g.stages.map((stage) => (
                <FulfillmentTile
                  key={stage.token}
                  stage={stage}
                  value={s[stage.key]}
                  active={active}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </div>
        </Fragment>
      ))}
    </div>
  );
}
