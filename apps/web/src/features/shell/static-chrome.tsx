import { buildNavSections, type DashboardRole } from "@/features/shell/dashboard-nav";

const ROLE_INITIALS: Record<DashboardRole, string> = { SUPER_ADMIN: "SA", MANAGER: "MG", ACCOUNTANT: "AC" };

/**
 * A static, non-interactive replica of the dashboard chrome (top bar + role-aware
 * sidebar + a faint content skeleton), shown behind a blocking overlay (payment
 * required / account paused) so the app reads as "paused" rather than gone.
 * Data-free: it reuses `buildNavSections` (a pure function) for the real nav
 * labels + icons, loads nothing, and is inert (aria-hidden, no links, no pointer
 * events). The scrim above it does the frosting.
 */
export function StaticChrome({ role }: { readonly role: DashboardRole }) {
  const sections = buildNavSections(role, "invoices");
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 select-none">
      {/* Top bar */}
      <div className="flex h-14 items-center gap-3 border-b border-border bg-card px-4">
        <div className="w-[216px] shrink-0 leading-tight">
          <div className="text-[15px] font-bold tracking-tight text-primary">Distribution OS</div>
          <div className="text-[9px] font-semibold tracking-[0.16em] text-muted-foreground">ENTERPRISE</div>
        </div>
        <div className="hidden h-9 max-w-sm flex-1 items-center rounded-lg border border-border bg-muted/40 px-3 text-[13px] text-muted-foreground sm:flex">
          Search customers, orders, invoices…
        </div>
        <div className="ml-auto grid size-8 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {ROLE_INITIALS[role]}
        </div>
      </div>

      <div className="flex h-[calc(100%-3.5rem)]">
        {/* Sidebar */}
        <nav className="hidden w-60 shrink-0 overflow-hidden border-r border-border bg-card px-3 py-4 lg:block">
          {sections.map((section) => (
            <div key={section.title} className="mb-3">
              <div className="px-3 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
                {section.title}
              </div>
              {section.items.map((item) => (
                <div
                  key={item.key}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium ${
                    item.active ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  <span className={item.active ? "text-primary-foreground" : "text-muted-foreground/70"}>{item.icon}</span>
                  {item.label}
                </div>
              ))}
            </div>
          ))}
        </nav>

        {/* Content skeleton */}
        <div className="flex-1 overflow-hidden p-6">
          <div className="h-6 w-48 rounded-md bg-card shadow-sm" />
          <div className="mt-3 h-3 w-72 rounded bg-card/80" />
          <div className="mt-5 flex gap-4">
            <div className="h-20 flex-1 rounded-xl bg-card shadow-sm" />
            <div className="h-20 flex-1 rounded-xl bg-card shadow-sm" />
            <div className="h-20 flex-1 rounded-xl bg-card shadow-sm" />
          </div>
          <div className="mt-4 h-64 rounded-xl bg-card shadow-sm" />
        </div>
      </div>
    </div>
  );
}
