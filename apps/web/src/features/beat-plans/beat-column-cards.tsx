"use client";

import { Fragment } from "react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { BeatSortableCard } from "./beat-card";
import type { BeatCustomer } from "./beat-plans-api";

const cityKey = (c: BeatCustomer) => (c.city ?? "").trim().toLowerCase();

/** The sortable stops inside a weekday column: numbered by visit order, with a
 *  subtle city label whenever the day spans more than one city. */
export function BeatColumnCards({
  customers,
  onRemove,
}: {
  readonly customers: BeatCustomer[];
  readonly onRemove: (customerId: string) => void;
}) {
  const ids = customers.map((c) => c.customerId);
  const showCity = new Set(customers.map(cityKey).filter(Boolean)).size > 1;

  return (
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      {customers.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-6 text-center text-[11.5px] text-muted-foreground">
          Drop customers here
        </p>
      ) : (
        customers.map((c, i) => {
          const newCity = showCity && cityKey(c) !== cityKey(customers[i - 1] ?? c) && i > 0;
          return (
            <Fragment key={c.customerId}>
              {(newCity || (showCity && i === 0)) && c.city ? (
                <p className="px-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                  {c.city}
                </p>
              ) : null}
              <BeatSortableCard customer={c} seq={i + 1} onRemove={() => onRemove(c.customerId)} />
            </Fragment>
          );
        })
      )}
    </SortableContext>
  );
}
