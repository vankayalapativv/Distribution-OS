import type { ColumnDef, SortingState } from "@tanstack/react-table";
import type { SkeletonCell } from "@/components/data-table/data-table";
import { customerColumns, customerSkeleton, deliveryColumns, deliverySkeleton } from "./logistics-columns";
import { runColumns, runSkeleton } from "./logistics-runs-columns";
import type { DeliveryCustomerRow, DeliveryStopRow } from "./logistics-api";
import type { DeliveryRunRow } from "./logistics-run-types";

export type View = "runs" | "customers" | "deliveries";
export type LogisticsRow = DeliveryRunRow | DeliveryCustomerRow | DeliveryStopRow;

export interface ViewConfig {
  label: string;
  noun: string;
  path: string;
  rowsKey: string;
  columns: ColumnDef<LogisticsRow>[];
  skeleton: SkeletonCell[];
  columnCount: number;
  initialSort: SortingState;
  /** How to search this view (placeholder hint). */
  searchPlaceholder: string;
}

/** Per-view table wiring — one source of truth for the toolbar tabs + the table. */
export const VIEW_CONFIG: Record<View, ViewConfig> = {
  runs: {
    label: "Runs",
    noun: "runs",
    path: "/logistics/runs",
    rowsKey: "runs",
    columns: runColumns as ColumnDef<LogisticsRow>[],
    skeleton: runSkeleton,
    columnCount: 7,
    initialSort: [{ id: "date", desc: true }],
    searchPlaceholder: "Search driver or vehicle…",
  },
  customers: {
    label: "By customer",
    noun: "customers",
    path: "/logistics/customers",
    rowsKey: "customers",
    columns: customerColumns as ColumnDef<LogisticsRow>[],
    skeleton: customerSkeleton,
    columnCount: 5,
    initialSort: [{ id: "lastDeliveryDate", desc: true }],
    searchPlaceholder: "Search customer…",
  },
  deliveries: {
    label: "By delivery",
    noun: "deliveries",
    path: "/logistics/deliveries",
    rowsKey: "deliveries",
    columns: deliveryColumns as ColumnDef<LogisticsRow>[],
    skeleton: deliverySkeleton,
    columnCount: 5,
    initialSort: [{ id: "date", desc: true }],
    searchPlaceholder: "Search customer…",
  },
};

export const VIEW_ORDER: View[] = ["runs", "customers", "deliveries"];
