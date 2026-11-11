"use client";

import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest, type ActionConfig } from "@/lib/api-client";
import { formatDate, rupeesExact } from "@/lib/format";
import { BillingBlockedScreen } from "./billing-blocked-screen";
import type { BillingAccessV2 } from "./billing-v2-api";
import { usePayCheckout } from "./use-pay-checkout";
import { payLabelFor } from "./pay-label";

const monthName = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", month: "long", year: "numeric" }).format(new Date(iso))
    : "this month";

/** "3 days left" / "1 day left" / "Last day" for the grace countdown chip. Pure. */
function daysLeftLabel(accessUntilMs: number | null | undefined, now: number): string | null {
  if (accessUntilMs == null) return null;
  const daysLeft = Math.max(0, Math.ceil((accessUntilMs - now) / 86_400_000));
  if (daysLeft <= 0) return "Last day";
  if (daysLeft === 1) return "1 day left";
  return `${daysLeft} days left`;
}

/** The sticky amber "payment due" banner shown while a month is in grace. */
function GraceBanner({ bannerRef, period, accessUntilIso, amount, daysLabel, canPay, phase, payLabel, onPay }: Readonly<{
  bannerRef: Ref<HTMLDivElement>;
  period: string; accessUntilIso: string | null; amount: string; daysLabel: string | null;
  canPay: boolean; phase: string; payLabel: string; onPay: () => void;
}>) {
  return (
    <div ref={bannerRef} className="sticky top-0 z-30 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-amber-900">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-600">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4m0 4h.01" strokeLinecap="round" />
        </svg>
      </span>
      <span className="min-w-0">
        <span className="text-sm font-semibold">Payment due — {period}</span>
        <span className="ml-2 text-[13px] text-amber-800">
          Access continues until <strong>{formatDate(accessUntilIso)}</strong>
          {amount ? <> · pay {amount} to avoid interruption.</> : "."}
        </span>
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-2.5">
        {daysLabel ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
            {daysLabel}
          </span>
        ) : null}
        {canPay ? (
          <Button onClick={onPay} disabled={phase !== "idle"}>
            {payLabel}
          </Button>
        ) : null}
      </span>
    </div>
  );
}

/**
 * Billing v2 in-app UX (standard monthly payments). Reads GET /billing/access
 * (initial from the server, then polls) and shows:
 *  - `grace` → non-blocking amber banner "Payment due — access until <date>"
 *    (a reminder — shown whenever a month is in grace, even with enforcement off).
 *  - `blocked` while enforced (lapsed live while browsing) → the full-screen
 *    BillingBlockedScreen.
 * On a normal page load a blocked+enforced org never reaches here — the layout
 * renders the block screen instead of the app. The server 402 gate is the real
 * enforcement. Renders nothing when billing can't be read (access null).
 */
export function BillingGuardV2({
  initial,
  actionConfig,
  children,
}: {
  readonly initial: BillingAccessV2 | null;
  readonly actionConfig: ActionConfig;
  readonly children: ReactNode;
}) {
  const [access, setAccess] = useState<BillingAccessV2 | null>(initial);
  const [now, setNow] = useState(() => Date.now());
  const { phase, payNow } = usePayCheckout(actionConfig, setAccess);

  async function refreshOnce() {
    try {
      setAccess(await apiRequest<BillingAccessV2>(actionConfig, "GET", "/billing/access"));
    } catch {
      /* keep last known */
    }
  }

  const enforced = access?.enforced === true;
  const blocked = access?.blocked === true;
  const state = access?.state ?? null;
  // The grace "payment due" banner is a reminder — show it whenever a month is
  // in grace, regardless of enforcement (so it's visible locally too). Only the
  // full-screen hard block + the server 402 gate are tied to `enforced`.
  const inGrace = state === "grace" && !blocked;
  const hardBlock = enforced && blocked;
  const amount = access?.current ? rupeesExact(access.current.amountPaisa / 100) : "";
  const period = monthName(access?.current?.periodStart ?? null);

  // Slow background refresh for lapse detection + on focus (also advances `now`
  // so the grace countdown stays current without reading the clock during render).
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
      void refreshOnce();
    }, 60_000);
    const onFocus = () => {
      setNow(Date.now());
      void refreshOnce();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionConfig]);

  const canPay = access?.canPay === true;
  const payLabel = payLabelFor(phase, amount);
  const daysLabel = daysLeftLabel(access?.accessUntilMs, now);

  // The banner is pinned at the very top; the sticky header + sidebar offset
  // themselves by its height via `--billing-banner-h` (the banner wraps to two
  // lines on narrow screens, so its height is measured, not assumed).
  const bannerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const root = document.documentElement;
    const el = bannerRef.current;
    if (!el) {
      root.style.setProperty("--billing-banner-h", "0px");
      return;
    }
    const sync = () => root.style.setProperty("--billing-banner-h", `${el.offsetHeight}px`);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.setProperty("--billing-banner-h", "0px");
    };
  }, [inGrace, access]);

  return (
    <>
      {inGrace && access ? (
        <GraceBanner
          bannerRef={bannerRef}
          period={period}
          accessUntilIso={access.accessUntilIso}
          amount={amount}
          daysLabel={daysLabel}
          canPay={canPay}
          phase={phase}
          payLabel={payLabel}
          onPay={() => void payNow(amount)}
        />
      ) : null}

      {children}

      {/* Billing lapsed live while browsing → the same full-screen block the
          layout renders on a fresh load. (On a fresh load a blocked+enforced org
          never renders children, so this only fires on a live transition.) */}
      {hardBlock && access ? <BillingBlockedScreen initial={access} actionConfig={actionConfig} /> : null}
    </>
  );
}
