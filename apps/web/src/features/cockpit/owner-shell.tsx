import type { ReactNode } from "react";

export type OwnerNavKey = "enterprises";

const NAV: Array<{ key: OwnerNavKey; label: string; href: string; hint: string }> = [
  { key: "enterprises", label: "Enterprises", href: "/owner", hint: "Review, approve, price & manage tenants" },
];

/**
 * Chrome for the platform-owner cockpit: a fixed sidebar (brand + nav) and a top
 * bar with a real logout button, mirroring the tenant app's `DashboardShell`
 * language but on its own subdomain. Presentational (no hooks) so it drops into
 * server pages. Logout posts to the shared `/api/auth/logout` endpoint, which is
 * owner-host-aware and clears the host-only `sa_session` cookie.
 */
export function OwnerShell({ active, children }: { active?: OwnerNavKey; children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-[240px] flex-none flex-col border-r border-border bg-card">
        <div className="flex h-14 items-center gap-2 border-b border-border px-5">
          <span className="text-[15px] font-extrabold tracking-tight">Distribution&nbsp;OS</span>
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.12em] text-primary">
            Owner
          </span>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-3">
          <div className="px-2 pb-1.5 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Control plane
          </div>
          {NAV.map((n) => (
            <a
              key={n.key}
              href={n.href}
              title={n.hint}
              className={`rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
                active === n.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {n.label}
            </a>
          ))}
        </nav>
        <div className="border-t border-border p-3 text-[11px] text-muted-foreground">
          Platform owner · vardhansystems
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 flex-none items-center justify-between border-b border-border px-6">
          <span className="text-[12.5px] font-semibold text-muted-foreground">Owner cockpit</span>
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="rounded-md border border-border px-3 py-1.5 text-[12.5px] font-semibold text-foreground hover:bg-accent"
            >
              Log out
            </button>
          </form>
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
