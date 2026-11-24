"use client";

import { useEffect, useState } from "react";

interface Charge {
  id: string;
  periodStart: string;
  periodEnd: string;
  seats: number;
  amountPaisa: number;
  status: string;
  paidAt: string | null;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
}

const inr = (p: number) => (p === 0 ? "₹0" : `₹${(p / 100).toLocaleString("en-IN")}`);
const monthLabel = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
};

function ChargeStatus({ s }: { s: string }) {
  const tone =
    s === "paid" ? "bg-[oklch(0.62_0.15_150/0.14)] text-[oklch(0.5_0.15_150)]" :
    s === "free" ? "bg-[oklch(0.57_0.13_60/0.16)] text-[oklch(0.5_0.13_60)]" :
    s === "void" ? "bg-muted text-muted-foreground" :
    "bg-destructive/10 text-destructive";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${tone}`}>{s}</span>;
}

/** Read-only subscription charge history for one enterprise (loads on mount). */
export function CockpitCharges({ enterpriseId }: { enterpriseId: string }) {
  const [rows, setRows] = useState<Charge[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/platform/${enterpriseId}?charges=1`, { cache: "no-store" });
        const b = (await res.json().catch(() => ({}))) as { data?: { charges?: Charge[] }; error?: { message?: string } };
        if (!alive) return;
        if (!res.ok) { setErr(b.error?.message ?? "Could not load charges."); return; }
        setRows(b.data?.charges ?? []);
      } catch {
        if (alive) setErr("Network error.");
      }
    })();
    return () => { alive = false; };
  }, [enterpriseId]);

  if (err) return <div className="text-[12.5px] text-destructive">{err}</div>;
  if (rows === null) return <div className="text-[12.5px] text-muted-foreground">Loading charges…</div>;
  if (rows.length === 0) return <div className="text-[12.5px] text-muted-foreground">No charges yet.</div>;

  return (
    <div className="overflow-hidden rounded-[7px] border border-border">
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="border-b border-border bg-secondary text-left text-[10.5px] uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 font-semibold">Month</th>
            <th className="px-3 py-2 font-semibold">Seats</th>
            <th className="px-3 py-2 font-semibold">Amount</th>
            <th className="px-3 py-2 font-semibold">Status</th>
            <th className="px-3 py-2 font-semibold">Paid</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="border-b border-border last:border-0">
              <td className="px-3 py-2 font-medium">{monthLabel(c.periodStart)}</td>
              <td className="px-3 py-2 text-muted-foreground">{c.seats}</td>
              <td className="px-3 py-2 font-mono">{inr(c.amountPaisa)}</td>
              <td className="px-3 py-2"><ChargeStatus s={c.status} /></td>
              <td className="px-3 py-2 text-muted-foreground">
                {c.paidAt ? new Date(c.paidAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
