"use client";

/** Collection Dues card (SUPER_ADMIN + MANAGER): the 4 aging buckets laid out
 *  around a central total ("four sides"), each clickable to its customer list.
 *  Aging is as-of-today (ignores the dashboard date range). GET /dues/summary. */
import { useState } from "react";
import dynamic from "next/dynamic";
import { errorMessage, type ActionConfig } from "@/lib/api-client";
import { useDelayedTrue } from "@/lib/use-delayed-true";
import { DuesFilters } from "./dues-card-filters";
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
  // On an exec/city change the summary refetches with keepPreviousData (isPending
  // false, old numbers linger), so also skeleton on a refetch past ~200ms.
  const slowRefetch = useDelayedTrue(summary.isFetching && !summary.isPending, 200);
  const showSkeleton = summary.isPending || slowRefetch;

  return (
    <section className="mb-7 rounded-xl border border-border bg-white p-5 shadow-sm">
      <DuesFilters
        executiveId={executiveId}
        city={city}
        salesExecutives={salesExecutives}
        cities={cities}
        onExec={(v) => { setExecutiveId(v); setCity(""); }} // reset city — may not belong to the new SE
        onCity={setCity}
      />

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
                posClass={POS[i]}
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
