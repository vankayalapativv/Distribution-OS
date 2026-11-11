"use client";

/**
 * Reports page body: a light `summary` fetch drives the card grid, split into an
 * Overall (all-brands) section + a dedicated section per brand. Each report's
 * detail is fetched on demand when its card opens — a chart above its table —
 * scoped to the chosen brand, with its own Excel / PDF download.
 */
import { useState } from "react";
import { keepPreviousData, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { ChevronLeft, Info } from "lucide-react";
import { withQueryClient } from "@/components/data-table/query-provider";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { type ActionConfig } from "@/lib/api-client";
import {
  fetchBrands,
  fetchBrandsSummary,
  fetchReport,
  fetchSummary,
  type ReportKey,
  type ReportRange,
  type ReportSlice,
} from "./reports-api";
import { ReportsRangePicker, todayRange } from "./reports-range-picker";
import {
  ALL_TIME_KEYS,
  CHART_KIND,
  REPORT_TITLES,
  REPORTS_SUBTITLE,
  REPORTS_TITLE,
  SNAPSHOT_KEYS,
} from "./reports-catalog";
import { ReportsOverview } from "./reports-cards";
import { ReportTable } from "./reports-table";
import { CHARTED_KEYS, ReportChart } from "./reports-chart";
import { ReportDownloadButtons } from "./reports-download-buttons";
import { ChartSkeleton, ReportsSkeleton, ReportTableSkeleton, Section } from "./reports-skeletons";
import { isAuthError, ReportsError } from "./reports-error";
import { ReportsCaExportDetail } from "./reports-ca-export";
import { ReportsProfitDetail } from "./reports-profit";

interface Selected {
  key: ReportKey;
  brand: string; // "all" | a brand name
}

function reportNote(key: ReportKey): string | null {
  if (ALL_TIME_KEYS.has(key)) return "All-time · ignores the selected date range";
  if (SNAPSHOT_KEYS.has(key)) return "As of today · ignores the selected date range";
  return null;
}

/** A drilled-in report: back link + download, an optional chart card, then the table.
 *  Each piece shimmers until its slice loads; a fetch error replaces chart + table. */
function ReportDetail({
  selected,
  reportQuery,
  onBack,
}: Readonly<{
  selected: Selected;
  reportQuery: UseQueryResult<ReportSlice>;
  onBack: () => void;
}>) {
  const heading =
    selected.brand === "all"
      ? REPORT_TITLES[selected.key]
      : `${selected.brand} · ${REPORT_TITLES[selected.key]}`;
  const note = reportNote(selected.key);
  const hasChart = CHARTED_KEYS.has(selected.key);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
          <ChevronLeft className="mr-1 size-4" /> All reports
        </Button>
        {reportQuery.data ? (
          <ReportDownloadButtons reportKey={selected.key} title={heading} slice={reportQuery.data} />
        ) : null}
      </div>
      {note ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="size-3.5" /> {note}
        </p>
      ) : null}
      {reportQuery.isError ? (
        <ReportsError
          error={reportQuery.error}
          onRetry={() => void reportQuery.refetch()}
          retrying={reportQuery.isFetching}
        />
      ) : (
        <>
          {hasChart ? (
            <Section heading={heading}>
              <div className="p-4">
                {reportQuery.data ? (
                  <ReportChart reportKey={selected.key} slice={reportQuery.data} />
                ) : (
                  <ChartSkeleton kind={CHART_KIND[selected.key]} />
                )}
              </div>
            </Section>
          ) : null}
          <Section heading={hasChart ? "Breakdown" : heading}>
            {reportQuery.data ? (
              <ReportTable reportKey={selected.key} slice={reportQuery.data} />
            ) : (
              <ReportTableSkeleton reportKey={selected.key} />
            )}
          </Section>
        </>
      )}
    </div>
  );
}

function ReportsViewInner({ actionConfig, role }: { readonly actionConfig: ActionConfig; readonly role: string }) {
  const canExportForCa = role === "SUPER_ADMIN" || role === "ACCOUNTANT";
  const [range, setRange] = useState<ReportRange>(() => todayRange());
  const [selected, setSelected] = useState<Selected | null>(null);
  const [caOpen, setCaOpen] = useState(false);
  const [profitOpen, setProfitOpen] = useState(false);

  const summaryQuery = useQuery({
    queryKey: ["reports", "summary", range.from, range.to],
    queryFn: () => fetchSummary(actionConfig, range),
    placeholderData: keepPreviousData,
    retry: (count, error) => !isAuthError(error) && count < 2,
  });

  // Live oil brands → dedicated per-brand report sections (new brands appear automatically).
  const brandsQuery = useQuery({
    queryKey: ["reports", "brands"],
    queryFn: () => fetchBrands(actionConfig),
    staleTime: 5 * 60_000,
    retry: (count, error) => !isAuthError(error) && count < 2,
  });
  const brands = brandsQuery.data ?? [];

  // Real per-brand numbers for the dedicated brand cards (re-fetched on range change).
  const brandsSummaryQuery = useQuery({
    queryKey: ["reports", "brands-summary", range.from, range.to],
    queryFn: () => fetchBrandsSummary(actionConfig, range),
    placeholderData: keepPreviousData,
    retry: (count, error) => !isAuthError(error) && count < 2,
  });
  const brandTeasers = brandsSummaryQuery.data ?? {};

  // Per-report detail — only fetched when a card is opened (shimmer while loading).
  const reportQuery = useQuery({
    queryKey: ["reports", "detail", range.from, range.to, selected?.brand, selected?.key],
    queryFn: () => fetchReport(actionConfig, range, selected!.key, selected!.brand),
    enabled: selected !== null,
    retry: (count, error) => !isAuthError(error) && count < 2,
  });

  const summary = summaryQuery.data;

  function body() {
    if (caOpen)
      return <ReportsCaExportDetail actionConfig={actionConfig} range={range} onBack={() => setCaOpen(false)} />;
    if (profitOpen)
      return <ReportsProfitDetail actionConfig={actionConfig} range={range} onBack={() => setProfitOpen(false)} />;
    if (selected)
      return <ReportDetail selected={selected} reportQuery={reportQuery} onBack={() => setSelected(null)} />;
    if (summaryQuery.isError)
      return (
        <ReportsError
          error={summaryQuery.error}
          onRetry={() => void summaryQuery.refetch()}
          retrying={summaryQuery.isFetching}
        />
      );
    if (summary)
      return (
        <ReportsOverview
          summary={summary.summary}
          brands={brands}
          brandTeasers={brandTeasers}
          onOpen={(key, brand) => setSelected({ key, brand })}
          onOpenCaExport={canExportForCa ? () => setCaOpen(true) : undefined}
          onOpenProfit={() => setProfitOpen(true)}
        />
      );
    return <ReportsSkeleton />;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={REPORTS_TITLE}
        subtitle={REPORTS_SUBTITLE}
        action={<ReportsRangePicker range={range} onChange={setRange} />}
      />
      {body()}
    </div>
  );
}

export const ReportsView = withQueryClient(ReportsViewInner);
