/** Aggregate report types: the whole bundle, the light summary, the per-report
 *  slice, and the page range. Row shapes live in reports-row-types.ts. */
import type {
  AdjustmentReport,
  AttendanceSummary,
  BacklogGroup,
  CollectionRow,
  CollectionTrendMonth,
  CustomerProductivity,
  CustomerReportRow,
  DistanceRow,
  OilSegmentGroup,
  OnboardingRow,
  OrderedGroup,
  ProductivityTrend,
  SalesRow,
  SkuReportRow,
  TrendMonth,
  VisitsTrend,
} from "./reports-row-types";

export * from "./reports-row-types";

export type ReportCadence = "daily" | "weekly" | "fortnightly" | "monthly";

export interface ReportPeriod {
  cadence: ReportCadence;
  start: string;
  end: string;
  label: string;
}

export interface ReportBundle {
  period: ReportPeriod;
  generatedAt: string;
  sales: { segments: string[]; rows: SalesRow[] };
  collections: { segments: string[]; rows: CollectionRow[] };
  distance: { rows: DistanceRow[] };
  onboarding: { rows: OnboardingRow[] };
  oils: { groups: OilSegmentGroup[] };
  backlog: { groups: BacklogGroup[]; totalValue: number; totalCount: number };
  orderedNotInvoiced: { groups: OrderedGroup[]; totalLitres: number; totalCount: number };
  customers: { rows: CustomerReportRow[] };
  oilsSku: SkuReportRow[];
  trend: TrendMonth[];
  collectionsTrend: { months: CollectionTrendMonth[] };
  cancelled: AdjustmentReport;
  returned: AdjustmentReport;
  productivityTrend: ProductivityTrend;
  customerProductivity: CustomerProductivity;
  visitsTrend: VisitsTrend;
  attendanceSummary: AttendanceSummary;
}

/** Headline aggregates for the KPI strip + cards (no row detail). */
export interface ReportsSummary {
  oilLitres: number;
  collected: number;
  distanceKm: number;
  newCustomers: number;
  backlogValue: number;
  backlogCount: number;
  pendingOrders: number;
  pendingLitres: number;
  oilSegments: number;
  execCount: number;
  fieldCount: number;
  customersReported: number;
  billedInvoices: number;
  billedValue: number;
  invoicedPreGst: number;
  invoicedWithGst: number;
}

export type ReportKey =
  | "sales"
  | "collections"
  | "distance"
  | "onboarding"
  | "oils"
  | "backlog"
  | "ordered"
  | "customers"
  | "oilsSku"
  | "trend"
  | "collectionsTrend"
  | "cancelled"
  | "returned"
  | "productivityTrend"
  | "customerProductivity"
  | "visitsTrend"
  | "attendanceSummary";

/** One report's detail (the rest of the bundle is absent). */
export type ReportSlice = Partial<ReportBundle> & {
  period: ReportPeriod;
  generatedAt: string;
};

/** Inclusive from–to range (yyyy-mm-dd) selected on the page. */
export interface ReportRange {
  from: string;
  to: string;
}
