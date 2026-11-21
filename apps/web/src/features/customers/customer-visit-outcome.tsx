"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { TableCell } from "@/components/ui/table";
import type { VisitRow } from "./customer-visits-logic";

/** The Outcome cell: order / collection / market-intel chips, or the amber
 *  no-outcome reason (or an em dash) when a visit produced nothing. */
export function VisitOutcomeCell({ visit: v }: Readonly<{ visit: VisitRow }>) {
  const noOutcome = v.orders.length === 0 && v.collections.length === 0 && v.marketIntelCount === 0;
  let fallback: ReactNode = null;
  if (noOutcome && v.noOutcomeReason) {
    fallback = <span className="text-xs italic text-amber-600">{v.noOutcomeReason}</span>;
  } else if (noOutcome) {
    fallback = <span className="text-xs text-slate-400">—</span>;
  }
  return (
    <TableCell>
      <div className="flex flex-wrap items-center gap-1">
        {fallback}
        {v.orders.map((o) => (
          <Link key={o.id} href={`/orders/${o.id}`}
            className="rounded-full bg-blue-50 px-2 py-0.5 font-mono text-[11px] font-medium text-blue-700 transition-colors hover:bg-blue-100 hover:underline">
            {o.code}
          </Link>
        ))}
        {v.collections.map((c) => (
          <Link key={c.id} href={`/collections/${c.id}`}
            className="rounded-full bg-emerald-50 px-2 py-0.5 font-mono text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-100 hover:underline">
            {c.code}
          </Link>
        ))}
        {v.marketIntelCount > 0 ? (
          <Link href="/market-intelligence"
            className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 transition-colors hover:bg-violet-100 hover:underline">
            Market intel · {v.marketIntelCount}
          </Link>
        ) : null}
      </div>
    </TableCell>
  );
}
