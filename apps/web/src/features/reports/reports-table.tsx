"use client";

/** Dispatches one drilled-in report's fetched slice to its table component. */
import type { ReactNode } from "react";
import { litres, rupees } from "@/lib/format";
import { GroupedTable, type GroupRow } from "./reports-grouped-table";
import { SegmentTable } from "./reports-table-kit";
import { SkuTable, skuOilsCell } from "./reports-tables-sku";
import { DistanceTable, OnboardingTable } from "./reports-tables-people";
import { OilsTable } from "./reports-tables-oils";
import { TrendTable } from "./reports-tables-trend";
import { CustomersTable } from "./reports-tables-customers";
import { AdjustmentTables } from "./reports-tables-adjustments";
import { AttendanceTable } from "./reports-tables-attendance";
import {
  CollectionsTrendTable,
  CustomerProductivityTable,
  ProductivityTrendTable,
  VisitsTrendTable,
} from "./reports-tables-visits";
import type { BacklogGroup, OrderedGroup, ReportKey, ReportSlice } from "./reports-types";

const backlogRows = (groups: BacklogGroup[]): GroupRow[] =>
  groups.map((g) => ({
    key: g.userId ?? g.name,
    name: g.name,
    count: g.count,
    total: g.totalValue,
    lines: g.invoices.map((inv) => ({ code: inv.invoiceNo, customer: inv.customer, value: inv.value })),
  }));

const orderedRows = (groups: OrderedGroup[]): GroupRow[] =>
  groups.map((g) => ({
    key: g.userId ?? g.name,
    name: g.name,
    count: g.count,
    total: g.totalLitres,
    lines: g.orders.map((o) => ({ code: o.orderCode, customer: o.customer, value: o.remainingLitres })),
  }));

/** Per-report table renderer, each returning null when its slice is absent. */
const RENDERERS: Partial<Record<ReportKey, (s: ReportSlice) => ReactNode>> = {
  sales: (s) => (s.sales ? <SegmentTable segments={s.sales.segments} rows={s.sales.rows} fmt={litres} /> : null),
  collections: (s) => (s.collections ? <SegmentTable segments={s.collections.segments} rows={s.collections.rows} fmt={rupees} /> : null),
  distance: (s) => (s.distance ? <DistanceTable rows={s.distance.rows} /> : null),
  onboarding: (s) => (s.onboarding ? <OnboardingTable rows={s.onboarding.rows} /> : null),
  oils: (s) => (s.oils ? <OilsTable groups={s.oils.groups} /> : null),
  backlog: (s) =>
    s.backlog ? (
      <GroupedTable
        codeHead="Invoice"
        valueHead="Value"
        noun="invoice"
        fmt={rupees}
        groups={backlogRows(s.backlog.groups)}
        total={s.backlog.totalValue}
        totalCount={s.backlog.totalCount}
      />
    ) : null,
  ordered: (s) =>
    s.orderedNotInvoiced ? (
      <GroupedTable
        codeHead="Order"
        valueHead="Pending litres"
        noun="order"
        fmt={litres}
        groups={orderedRows(s.orderedNotInvoiced.groups)}
        total={s.orderedNotInvoiced.totalLitres}
        totalCount={s.orderedNotInvoiced.totalCount}
      />
    ) : null,
  customers: (s) => (s.customers ? <CustomersTable rows={s.customers.rows} /> : null),
  oilsSku: (s) => (s.oilsSku ? <SkuTable rows={s.oilsSku} unit="Litres" unitCell={skuOilsCell} /> : null),
  trend: (s) => (s.trend ? <TrendTable months={s.trend} /> : null),
  collectionsTrend: (s) => (s.collectionsTrend ? <CollectionsTrendTable months={s.collectionsTrend.months} /> : null),
  cancelled: (s) => (s.cancelled ? <AdjustmentTables report={s.cancelled} /> : null),
  returned: (s) => (s.returned ? <AdjustmentTables report={s.returned} /> : null),
  productivityTrend: (s) => (s.productivityTrend ? <ProductivityTrendTable data={s.productivityTrend} /> : null),
  customerProductivity: (s) => (s.customerProductivity ? <CustomerProductivityTable data={s.customerProductivity} /> : null),
  visitsTrend: (s) => (s.visitsTrend ? <VisitsTrendTable data={s.visitsTrend} /> : null),
  attendanceSummary: (s) => (s.attendanceSummary ? <AttendanceTable rows={s.attendanceSummary.rows} /> : null),
};

export function ReportTable({ reportKey, slice }: Readonly<{ reportKey: ReportKey; slice: ReportSlice }>) {
  return RENDERERS[reportKey]?.(slice) ?? null;
}
