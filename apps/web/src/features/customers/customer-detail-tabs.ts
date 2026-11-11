import { INFO_TABS } from "./customer-detail-sections";

export type CustomerDetailRole = "SUPER_ADMIN" | "MANAGER" | "ACCOUNTANT";

export const ORDERS_TAB = "orders";
export const LEDGER_TAB = "ledger";
export const PHOTOS_TAB = "photos";
export const VISITS_TAB = "visits";
export const NOTES_TAB = "notes";

export interface DetailTab {
  key: string;
  label: string;
  count: number | undefined;
}

/** Build the tab bar: the info tab(s) plus Orders / Ledger / Notes / Visits /
 *  Photos, each with a count badge (undefined while its query is loading). */
export function buildTabs(counts: {
  ordersTotal: number;
  ordersLoading: boolean;
  visitsCount: number;
  visitsLoading: boolean;
  photosCount: number;
  photosLoading: boolean;
}): DetailTab[] {
  return [
    ...INFO_TABS.map((t) => ({ key: t.key, label: t.label, count: undefined })),
    { key: ORDERS_TAB, label: "Orders", count: counts.ordersLoading ? undefined : counts.ordersTotal },
    { key: LEDGER_TAB, label: "Ledger", count: undefined },
    { key: NOTES_TAB, label: "Notes", count: undefined },
    { key: VISITS_TAB, label: "Visits", count: counts.visitsLoading ? undefined : counts.visitsCount },
    { key: PHOTOS_TAB, label: "Photos", count: counts.photosLoading ? undefined : counts.photosCount },
  ];
}
