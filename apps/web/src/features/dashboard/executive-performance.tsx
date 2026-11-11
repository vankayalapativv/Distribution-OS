import type { ExecutivePerformanceRow } from "./dashboard-experience";

function GpsStatusBadge({ status }: { readonly status: string }) {
  const active = status === "active";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        active
          ? "bg-green-50 text-green-700 ring-1 ring-green-600/20"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${active ? "bg-green-500" : "bg-slate-400"}`}
      />
      {status}
    </span>
  );
}

/**
 * Legacy Sales-Executive performance table (reporting-only), shown for roles
 * without the live metrics dashboard (ACCOUNTANT). Server component.
 */
export function ExecutivePerformanceTable({
  rows,
}: {
  readonly rows: ExecutivePerformanceRow[];
}) {
  return (
    <section className="rounded-lg border border-border bg-white">
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-sm font-semibold text-foreground">
          Sales Executive Performance
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Reporting data only. Sales Executive screens are in the React Native mobile app.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-slate-50">
              <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Executive
              </th>
              <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Visits
              </th>
              <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Productive
              </th>
              <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Sales
              </th>
              <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Collections
              </th>
              <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                GPS
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.name} className="transition-colors hover:bg-accent/40">
                <td className="px-4 py-3 font-medium text-foreground">{row.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.visits}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.productiveVisits}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.salesValue}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.collections}</td>
                <td className="px-4 py-3">
                  <GpsStatusBadge status={row.gpsStatus} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
