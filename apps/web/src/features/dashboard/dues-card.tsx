"use client";

/** Collection Dues card (SUPER_ADMIN + MANAGER): the 4 aging buckets laid out
 *  around a central total ("four sides"), each clickable to its customer list.
 *  Aging is as-of-today (ignores the dashboard date range). GET /dues/summary. */
import { useState } from "react";
import dynamic from "next/dynamic";
import { errorMessage, type ActionConfig } from "@/lib/api-client";
import { useDelayedTrue } from "@/lib/use-delayed-true";
import { SearchSelect } from "@/features/orders/search-select";
import { useDuesDrilldown } from "./use-dues-drilldown";
import { useDuesData } from "./use-dues-data";
import { BucketTile, DuesTotalTile, PLACEHOLDER_BUCKETS, POS } from "./dues-card-parts";
import { accentForIndex } from "./dues-helpers";

// The dues drill-down dialog pulls in framer-motion (via AnimatedSwap); it only
// renders after the user opens a bucket, so load it lazily and mount it on first
// open (kept mounted afterward for the close transition).
const DuesDrilldownDialog = dynamic(
  () => import("./dues-drilldown").then((m) => m.DuesDrilldownDialog),
  { ssr: false },
);

export function DuesCard({ actionConfig }: Readonly<{ actionConfig: ActionConfig }>) {
  const [executiveId, setExecutiveId] = useState("");
  const [city, setCity] = useState("");
  const { cities, salesExecutives, summary } = useDuesData(actionConfig, executiveId, city);
  const data = summary.data;
  const drill = useDuesDrilldown(actionConfig, { executiveId, city }, data?.buckets ?? []);
  // Mount the lazy drill-down on first open, kept mounted afterward (close
  // transition). Latch via set-state-during-render — no effect, no extra commit.
  const [drilldownMounted, setDrilldownMounted] = useState(false);
  if (drill.bucket && !drilldownMounted) setDrilldownMounted(true);
  // On an executive/city change the summary refetches with `keepPreviousData`, so
  // `isPending` is false and the OLD numbers linger. Show the skeleton on the
  // first load OR when a refetch runs past ~200ms — a fast swap stays instant.
  const slowRefetch = useDelayedTrue(summary.isFetching && !summary.isPending, 200);
  const showSkeleton = summary.isPending || slowRefetch;

  return (
    <section className="mb-7 rounded-xl border border-border bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Collection Dues</h3>
        <div className="flex items-center gap-2">
          <div className="w-[180px]">
            <SearchSelect
              items={[{ id: "", name: "All executives" }, ...salesExecutives]}
              valueKey={executiveId}
              getKey={(x) => x.id}
              getLabel={(x) => x.name}
              onSelect={(v) => {
                setExecutiveId(v);
                setCity(""); // reset city — the old one may not belong to the new SE
              }}
              placeholder="All executives"
              searchPlaceholder="Search executive…"
              emptyText="No executives found"
              contentClassName="w-[220px] p-0"
            />
          </div>
          <div className="w-[170px]">
            <SearchSelect
              items={[{ id: "", name: "All cities" }, ...cities.map((c) => ({ id: c, name: c }))]}
              valueKey={city}
              getKey={(x) => x.id}
              getLabel={(x) => x.name}
              onSelect={setCity}
              placeholder="All cities"
              searchPlaceholder="Search city…"
              emptyText="No cities found"
              contentClassName="w-[220px] p-0"
            />
          </div>
        </div>
      </div>

      {!showSkeleton && (summary.isError || !data) ? (
        <p className="py-8 text-center text-sm text-destructive">
          {errorMessage(summary.error, "Could not load collection dues.")}
        </p>
      ) : (
        // The 4-band cross: bands on the four sides (newest top → oldest left),
        // Total dues in the centre. The model is fixed at 4 bands; their labels +
        // ranges are per-enterprise. On load / a >200ms refetch only each tile's
        // figures shimmer; the accent is graded by position (newest cool, oldest hot).
        <div className="mx-auto grid max-w-2xl grid-cols-3 grid-rows-3 gap-3">
          {(() => {
            const list = (data?.buckets ?? PLACEHOLDER_BUCKETS).slice(0, 4);
            return list.map((b, i) => (
              <BucketTile
                key={b.key}
                bucket={b}
                accent={accentForIndex(i, list.length)}
                posClass={POS[i] ?? ""}
                onOpen={drill.open}
                loading={showSkeleton}
              />
            ));
          })()}
          <DuesTotalTile
            outstanding={data?.totalOutstanding ?? 0}
            customers={data?.totalCustomers ?? 0}
            loading={showSkeleton}
          />
        </div>
      )}

      {!showSkeleton && !summary.isError && data ? (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Aged per invoice — a customer with invoices of different ages can appear in more than one band.
        </p>
      ) : null}

      {drilldownMounted ? (
        <DuesDrilldownDialog
          bucket={drill.bucket}
          rows={drill.rows}
          error={drill.error}
          onOpenChange={(open) => {
            if (!open) drill.close();
          }}
        />
      ) : null}
    </section>
  );
}
