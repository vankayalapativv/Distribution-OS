import type { SortingState } from "@tanstack/react-table";
import { ROLE_LABELS } from "./super-admin-types";

// URL param names (also the API's filter param names) + the default sort.
export const USER_FILTER_KEYS = ["search", "role", "status"] as const;
export const USER_SORT: SortingState = [{ id: "name", desc: false }];

export const ALL = "__all"; // Select needs a non-empty sentinel for the "all" option.

export const ROLE_FILTER_OPTIONS = [
  { value: ALL, label: "All roles" },
  ...Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label })),
];

export const STATUS_FILTER_OPTIONS = [
  { value: ALL, label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export const USER_STATUS_TONES: Record<string, string> = {
  active: "bg-secondary text-secondary-foreground",
  inactive: "bg-muted text-muted-foreground",
};
