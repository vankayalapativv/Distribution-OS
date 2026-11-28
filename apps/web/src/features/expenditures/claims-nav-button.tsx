"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useCan } from "@/features/shell/use-can";
import type { ActionConfig } from "@/lib/api-client";
import { useClaimsQueue } from "./use-claims-queue";

/** "Claims" button beside Record Expenditure — carries a red pending-count badge
 *  and opens the Claims page. Shown only to users who can approve claims. */
export function ClaimsNavButton({ actionConfig }: { readonly actionConfig: ActionConfig }) {
  const router = useRouter();
  const canApprove = useCan("action:expenditures.claims.approve");
  const { claims } = useClaimsQueue(actionConfig);

  if (!canApprove) return null;
  const pending = claims.length;

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
