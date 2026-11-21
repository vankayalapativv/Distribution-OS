import type { SortingState } from "@tanstack/react-table";

// URL param names (also the API's filter param names) + the default sort.
export const CUSTOMER_FILTER_KEYS = ["search", "city", "salesExecutiveId", "dues"] as const;
export const CUSTOMER_SORT: SortingState = [{ id: "legalName", desc: false }];

export const ALL = "__all"; // Select needs a non-empty sentinel for the "all" option.
export const DUES_OPTIONS: { value: string; label: string }[] = [
  { value: ALL, label: "All dues" },
  { value: "owes", label: "Owes" },
  { value: "credit", label: "In credit" },
  { value: "settled", label: "Settled" },
];

export type CustomersRole = "SUPER_ADMIN" | "MANAGER" | "ACCOUNTANT";
