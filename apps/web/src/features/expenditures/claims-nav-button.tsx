"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { fetchBadgeCounts } from "@/features/shell/badge-fetch";
import { useCan } from "@/features/shell/use-can";

/** "Claims" button beside Record Expenditure — carries a red pending-count badge
 *  and opens the Claims page. Shown only to users who can approve claims; the
 *  count comes from the shared `/api/badge-counts` source (same one the sidebar
 *  badge uses), so there's a single source of truth and no extra list fetch. */
export function ClaimsNavButton() {
  const router = useRouter();
  const canApprove = useCan("action:expenditures.claims.approve");
  const { data } = useQuery({
    queryKey: ["badge-counts"],
    queryFn: () => fetchBadgeCounts(),
    enabled: canApprove,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  if (!canApprove) return null;
  const pending = data?.expenditureClaimsPending ?? 0;

  return (
    <Button variant="outline" onClick={() => router.push("/expenditures/claims")}>
      Claims
      {pending > 0 ? (
        <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-semibold text-white">
          {pending}
        </span>
      ) : null}
    </Button>
  );
}
