import { Shimmer } from "@/components/ui/shimmer";

// Loading placeholder for one RolePanel. Mirrors its real layout — header with a
// title + meter bar + control row, then the "Sections" / "Actions" groups with a
// label and switch on each row — so a load reads as "this exact card is arriving".
const GROUPS: { label: string; rows: number }[] = [
  { label: "Sections", rows: 18 },
  { label: "Actions", rows: 10 },
];

export function PanelSkeleton() {
  return (
    <section className="flex flex-col rounded-xl border border-border bg-card">
      <header className="flex flex-col gap-2.5 border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <Shimmer className="h-5 w-40" />
          <Shimmer className="h-3 w-16" />
        </div>
        <Shimmer className="h-1.5 w-full rounded-full" />
        <div className="flex items-center gap-2">
          <Shimmer className="h-7 w-20" />
          <Shimmer className="h-7 w-20" />
          <Shimmer className="h-7 w-14" />
        </div>
      </header>

      <div className="flex flex-col gap-3 p-3">
        {GROUPS.map((g) => (
          <div key={g.label} className="flex flex-col gap-1">
            <p className="px-1 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
              {g.label}
            </p>
            <div className="grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2">
              {Array.from({ length: g.rows }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-2 py-1.5">
                  <Shimmer className="h-4 w-36" />
                  <Shimmer className="h-5 w-9 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
