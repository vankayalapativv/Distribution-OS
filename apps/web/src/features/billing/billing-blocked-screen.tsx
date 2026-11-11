"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { type ActionConfig } from "@/lib/api-client";
import { rupeesExact } from "@/lib/format";
import { buildNavSections, type DashboardRole } from "@/features/shell/dashboard-nav";
import type { BillingAccessV2 } from "./billing-v2-api";
import { rateLabel } from "./billing-format";
import { usePayCheckout } from "./use-pay-checkout";
import { payLabelFor } from "./pay-label";

const monthName = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", month: "long", year: "numeric" }).format(new Date(iso))
    : "this month";

const ROLE_INITIALS: Record<DashboardRole, string> = { SUPER_ADMIN: "SA", MANAGER: "MG", ACCOUNTANT: "AC" };

/**
 * A static, non-interactive replica of the dashboard chrome (top bar + role-aware
 * sidebar + a faint content skeleton), shown behind the payment block so the app
 * reads as "paused" rather than gone. Data-free: it reuses `buildNavSections`
 * (a pure function) for the real nav labels + icons, loads nothing, and is inert
 * (aria-hidden, no links, no pointer events). The scrim above it does the frosting.
 */
function StaticChrome({ role }: { readonly role: DashboardRole }) {
  const sections = buildNavSections(role, "invoices");
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 select-none">
      {/* Top bar */}
      <div className="flex h-14 items-center gap-3 border-b border-border bg-card px-4">
        <div className="w-[216px] shrink-0 leading-tight">
          <div className="text-[15px] font-bold tracking-tight text-primary">Sri Aparajita</div>
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

/**
 * Full-screen "Payment required" block (Billing v2). Shown when billing is
 * blocked AND enforced — rendered by the dashboard layout INSTEAD of the app
 * (so no page data loads → no 402 error), and also by BillingGuardV2 if billing
 * lapses live while browsing. Web roles get a Pay button; others a contact note.
 * On successful payment the page reloads to restore the app.
 *
 * `role` (layout case only) draws a static, dimmed dashboard chrome behind the
 * card. On a live lapse the real app is already behind the overlay, so `role` is
 * omitted there.
 */
export function BillingBlockedScreen({
  initial,
  actionConfig,
  role,
}: {
  readonly initial: BillingAccessV2;
  readonly actionConfig: ActionConfig;
  readonly role?: DashboardRole;
}) {
  const [access, setAccess] = useState<BillingAccessV2>(initial);
  const { phase, error, payNow } = usePayCheckout(actionConfig, (a) => {
    setAccess(a);
    if (!a.blocked) window.location.reload(); // restore the app once paid
  });

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const current = access.current;
  const amount = current ? rupeesExact(current.amountPaisa / 100) : "—";
  const month = monthName(current?.periodStart ?? null);
  const seats = current?.seats ?? 0;
  const canPay = access.canPay;
  const payLabel = payLabelFor(phase, amount);

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      {/* Dimmed, inert chrome behind (layout case). On a live lapse the real app is already there. */}
      {role ? (
        <StaticChrome role={role} />
      ) : (
        <div className="absolute left-5 top-4 leading-tight">
          <div className="text-sm font-bold tracking-tight text-primary">Sri Aparajita</div>
          <div className="text-[8px] font-semibold tracking-[0.14em] text-muted-foreground">ENTERPRISE</div>
        </div>
      )}

      {/* Frosted scrim over the chrome */}
      <div aria-hidden className="absolute inset-0 bg-background/60 backdrop-blur-[3px]" />

      {/* Payment block card */}
      <div className="relative grid min-h-full place-items-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center shadow-xl dark:border-amber-900/40 dark:bg-amber-950/30">
          <h1 className="text-xl font-bold tracking-tight text-amber-900 dark:text-amber-200">Payment required</h1>
          <p className="mx-auto mt-2 max-w-[34ch] text-[13.5px] leading-relaxed text-amber-800 dark:text-amber-300/90">
            Access to the application is paused until the pending payment is cleared. Your data stays safe, and access
            returns the moment it&rsquo;s confirmed.
          </p>

          {current ? (
            <dl className="mt-5 overflow-hidden rounded-xl border border-amber-200 bg-card text-left text-[13px] dark:border-amber-900/40">
              <div className="flex justify-between px-4 py-3">
                <dt className="text-muted-foreground">Billing month</dt>
                <dd className="font-semibold text-card-foreground">{month}</dd>
              </div>
              <div className="flex justify-between border-t border-amber-100 px-4 py-3 dark:border-amber-900/30">
                <dt className="text-muted-foreground">{access.config?.model === "flat" ? "Plan" : "Active users"}</dt>
                <dd className="font-semibold tabular-nums text-card-foreground">
                  {access.config?.model === "flat" ? "Flat monthly" : `${seats} × ${rateLabel(access.config).replace(" per active user", "")}`}
                </dd>
              </div>
              <div className="flex items-center justify-between border-t border-amber-100 bg-amber-50/60 px-4 py-3 dark:border-amber-900/30 dark:bg-amber-950/20">
                <dt className="font-semibold text-card-foreground">Amount due</dt>
                <dd className="text-xl font-bold tabular-nums text-amber-700 dark:text-amber-400">{amount}</dd>
              </div>
            </dl>
          ) : null}

          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

          <div className="mt-5">
            {canPay ? (
              <Button onClick={() => void payNow(amount)} disabled={phase !== "idle"} className="h-11 w-full text-[15px]">
                {payLabel}
              </Button>
            ) : (
              <p className="text-sm text-amber-800 dark:text-amber-300/90">Please contact your administrator to make the payment.</p>
            )}
          </div>

          {canPay ? (
            <p className="mt-3 text-[11.5px] text-amber-800/80 dark:text-amber-300/70">Secured by Razorpay · incl. 18% GST</p>
          ) : null}

          {/* Support contact */}
          <div className="mt-5 border-t border-amber-200 pt-4 text-[12.5px] leading-relaxed text-amber-800 dark:border-amber-900/40 dark:text-amber-300/90">
            <span className="block font-semibold text-amber-900 dark:text-amber-200">Need help?</span>
            Call{" "}
            <a href="tel:+916304800595" className="font-medium text-primary hover:underline">+91&nbsp;63048&nbsp;00595</a>{" "}
            or email{" "}
            <a href="mailto:vishnuvardhan@vardhansystems.in" className="font-medium text-primary hover:underline">
              vishnuvardhan@vardhansystems.in
            </a>
            <span className="mt-0.5 block text-amber-800/80 dark:text-amber-300/70">8am–4pm, every day</span>
          </div>
        </div>
      </div>
    </div>
  );
}
