"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiGet, errorMessage, type ActionConfig } from "@/lib/api-client";
import type { DuesBucket, DuesCustomerRow } from "./dues-helpers";

/** Opens a bucket's customer list on demand, now URL-backed (`?bucket=`) so Back
 *  closes it and a refresh/return restores it. Opening PUSHES a history entry;
 *  closing REPLACES it away. Rows are fetched with TanStack Query (cached). The
 *  `buckets` list resolves the clicked key back to its bucket (label/accent). */
const NO_FILTERS = { executiveId: "", city: "" };

export function useDuesDrilldown(
  actionConfig: ActionConfig,
  filters: { executiveId: string; city: string } = NO_FILTERS,
  buckets: DuesBucket[] = [],
) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const spString = searchParams.toString();

  const bucketKey = useMemo(() => new URLSearchParams(spString).get("bucket"), [spString]);
  const bucket = bucketKey ? buckets.find((b) => b.key === bucketKey) ?? null : null;

  const query = useQuery({
    queryKey: ["dues-customers", bucketKey, filters.executiveId, filters.city],
    queryFn: () => {
      const params = new URLSearchParams({ bucket: bucketKey! });
      if (filters.executiveId) params.set("executiveId", filters.executiveId);
      if (filters.city) params.set("city", filters.city);
      return apiGet<{ customers: DuesCustomerRow[] }>(actionConfig, `/dues/customers?${params.toString()}`);
    },
    enabled: !!bucketKey,
  });

  const navigate = useCallback(
    (key: string, mode: "push" | "replace") => {
      const sp = new URLSearchParams(spString);
      if (key) sp.set("bucket", key);
      else sp.delete("bucket");
      const qs = sp.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (mode === "push") router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [spString, pathname, router],
  );

  return {
    bucket,
    rows: bucketKey ? (query.data?.customers ?? null) : null,
    error: query.isError ? errorMessage(query.error, "Could not load customers.") : null,
    open: (b: DuesBucket) => navigate(b.key, "push"),
    close: () => navigate("", "replace"),
  };
}
