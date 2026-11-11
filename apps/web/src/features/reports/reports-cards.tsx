"use client";

/**
 * Reports overview: a KPI strip + three sections of clickable cards —
 * "Overall" (all reports, all brands) and one dedicated section per brand
 * (Fuchs, Savsol) with that company's product reports. Clicking a card drills
 * into that report's chart + table, scoped to the chosen brand.
 */
import {
  Activity,
  Award,
  BarChart3,
  Ban,
  ChevronRight,
  ClipboardList,
  Clock,
  Droplets,
  FileSpreadsheet,
  Footprints,
  IndianRupee,
  LineChart,
  MapPin,
  PackageX,
  TrendingUp,
  Undo2,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { litres, rupees } from "@/lib/format";
import { REPORT_SHORT } from "./reports-catalog";
import { KpiStrip } from "./reports-kpi-strip";
import type { BrandTeaser } from "./reports-api";
import type { ReportKey, ReportsSummary } from "./reports-types";

/** Litres with a unit, showing 0 as "0 L" (litres() renders 0 as "—"). */
function litresU(n: number): string {
  return `${n === 0 ? "0" : litres(n)} L`;
}

const ICONS: Record<ReportKey, LucideIcon> = {
  sales: BarChart3,
  collections: IndianRupee,
  distance: MapPin,
  onboarding: UserPlus,
  oils: Droplets,
  backlog: PackageX,
  ordered: ClipboardList,
  customers: Users,
  oilsSku: Droplets,
  trend: TrendingUp,
  collectionsTrend: LineChart,
  cancelled: Ban,
  returned: Undo2,
  productivityTrend: Activity,
  customerProductivity: Award,
  visitsTrend: Footprints,
  attendanceSummary: Clock,
};

/** Product reports that get a dedicated per-brand version (brand-filterable). */
export const PRODUCT_KEYS: ReportKey[] = ["sales", "oils", "ordered", "oilsSku", "cancelled", "returned"];

const EMPTY_TEASER: BrandTeaser = {
  oilLitres: 0, pendingOrders: 0, pendingLitres: 0, billedInvoices: 0, cancelledLitres: 0, returnedLitres: 0,
};

/** Real-number teaser for one product report under a given brand. */
function brandTeaser(key: ReportKey, t: BrandTeaser): { primary: string; secondary: string } {
  switch (key) {
    case "sales":
      return { primary: litresU(t.oilLitres), secondary: "ordered" };
    case "oils":
      return { primary: litresU(t.oilLitres), secondary: "by segment" };
    case "ordered":
      return { primary: `${t.pendingOrders} orders`, secondary: `${litresU(t.pendingLitres)} pending` };
    case "oilsSku":
      return { primary: `${t.billedInvoices} invoices`, secondary: "oils billed" };
    case "cancelled":
      return { primary: litresU(t.cancelledLitres), secondary: "cancelled" };
    case "returned":
      return { primary: litresU(t.returnedLitres), secondary: "returned" };
    default:
      return { primary: "—", secondary: "" };
  }
}

interface CardDef {
  key: ReportKey;
  primary: string;
  secondary: string;
}

/** The "Overall" (all-brands) cards, with live teasers from the summary. */
function overallCards(m: ReportsSummary): CardDef[] {
  return [
    { key: "sales", primary: litresU(m.oilLitres), secondary: `${m.execCount} executives` },
    { key: "collections", primary: rupees(m.collected), secondary: "by customer segment" },
    { key: "distance", primary: `${Math.round(m.distanceKm)} km`, secondary: `${m.fieldCount} people` },
    { key: "onboarding", primary: String(m.newCustomers), secondary: "new customers" },
    { key: "oils", primary: litresU(m.oilLitres), secondary: `${m.oilSegments} segments` },
    { key: "backlog", primary: rupees(m.backlogValue), secondary: `${m.backlogCount} invoices` },
    { key: "ordered", primary: `${m.pendingOrders} orders`, secondary: `${litresU(m.pendingLitres)} pending` },
    { key: "customers", primary: String(m.customersReported), secondary: "active customers" },
    { key: "oilsSku", primary: `${m.billedInvoices} invoices`, secondary: "oils billed" },
    { key: "trend", primary: rupees(m.billedValue), secondary: "billed · 6-month" },
    { key: "collectionsTrend", primary: "6 months", secondary: "collections trend" },
    { key: "cancelled", primary: "Cancelled", secondary: "orders · by executive" },
    { key: "returned", primary: "Returned", secondary: "orders · by executive" },
    { key: "productivityTrend", primary: "Productivity %", secondary: "by executive · 6-month" },
    { key: "customerProductivity", primary: "Best & worst", secondary: "customers · all-time" },
    { key: "visitsTrend", primary: "Visits", secondary: "6-month trend" },
    { key: "attendanceSummary", primary: "Time & attendance", secondary: "SE & logistics" },
  ];
}

function Card({
  cardKey,
  primary,
  secondary,
  onOpen,
}: Readonly<{ cardKey: ReportKey; primary: string; secondary: string; onOpen: () => void }>) {
  const Icon = ICONS[cardKey];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex items-center gap-4 rounded-xl border border-border bg-white p-4 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
    >
      <span className="flex size-11 flex-none items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{REPORT_SHORT[cardKey]}</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{primary}</span> · {secondary}
        </span>
      </span>
      <ChevronRight className="size-4 flex-none text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

function CardGrid({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

/** A fixed card for the "Tax Export" workbook (not a summary-driven report). */
function CaExportCard({ onOpen }: Readonly<{ onOpen: () => void }>) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex items-center gap-4 rounded-xl border border-border bg-white p-4 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
    >
      <span className="flex size-11 flex-none items-center justify-center rounded-lg bg-primary/10 text-primary">
        <FileSpreadsheet className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">Tax Export</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">GSTR-1</span> · B2B · B2CS · HSN
        </span>
      </span>
      <ChevronRight className="size-4 flex-none text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

/** A fixed card for the Profitability report (opens the 4-tab detail; not summary-driven). */
function ProfitabilityCard({ onOpen }: Readonly<{ onOpen: () => void }>) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex items-center gap-4 rounded-xl border border-border bg-white p-4 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
    >
      <span className="flex size-11 flex-none items-center justify-center rounded-lg bg-primary/10 text-primary">
        <TrendingUp className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">Profitability</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">
          Sold − expenses − cost · by invoice / customer / SKU / area
        </span>
      </span>
      <ChevronRight className="size-4 flex-none text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

function SectionHeading({ label }: Readonly<{ label: string }>) {
  return <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</h3>;
}

export function ReportsOverview({
  summary,
  brands,
  brandTeasers,
  onOpen,
  onOpenCaExport,
  onOpenProfit,
}: Readonly<{
  summary: ReportsSummary;
  brands: readonly string[];
  brandTeasers: Record<string, BrandTeaser>;
  onOpen: (key: ReportKey, brand: string) => void;
  /** When present (office roles that may export), shows the "Tax Export" card. */
  onOpenCaExport?: () => void;
  /** Opens the Profitability report detail. */
  onOpenProfit?: () => void;
}>) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <KpiStrip m={summary} />
        <SectionHeading label="Overall · all brands" />
        <CardGrid>
          {overallCards(summary).map((c) => (
            <Card key={c.key} cardKey={c.key} primary={c.primary} secondary={c.secondary} onOpen={() => onOpen(c.key, "all")} />
          ))}
          {onOpenProfit ? <ProfitabilityCard onOpen={onOpenProfit} /> : null}
        </CardGrid>
      </div>
      {onOpenCaExport ? (
        <div className="flex flex-col gap-4">
          <SectionHeading label="Tax & compliance" />
          <CardGrid>
            <CaExportCard onOpen={onOpenCaExport} />
          </CardGrid>
        </div>
      ) : null}
      {brands.map((brand) => {
        const t = brandTeasers[brand] ?? EMPTY_TEASER;
        return (
          <div key={brand} className="flex flex-col gap-4">
            <SectionHeading label={`${brand} · product reports`} />
            <CardGrid>
              {PRODUCT_KEYS.map((key) => {
                const teaser = brandTeaser(key, t);
                return (
                  <Card key={key} cardKey={key} primary={teaser.primary} secondary={teaser.secondary} onOpen={() => onOpen(key, brand)} />
                );
              })}
            </CardGrid>
          </div>
        );
      })}
    </div>
  );
}
