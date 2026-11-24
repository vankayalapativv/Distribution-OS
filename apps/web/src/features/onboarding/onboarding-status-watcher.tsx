"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Lives on the "pending approval" screen. Polls the onboarding status every
 * `intervalMs`; the moment the owner acts, it reacts WITHOUT a manual refresh:
 *  - approved (`active`)  → a brief "You're approved!" splash, then into the app
 *    (`/auth/redirect` routes a web role to the dashboard).
 *  - rejected / suspended / any other change → reload so the onboarding page
 *    re-renders the right screen (rejection reason / access-paused).
 * Transient fetch failures are ignored (keep waiting) so a blip never bounces
 * the applicant out.
 */
export function OnboardingStatusWatcher({ intervalMs = 10_000 }: { intervalMs?: number }) {
  const [approved, setApproved] = useState(false);
  const settled = useRef(false);

  useEffect(() => {
    async function check() {
      if (settled.current) return;
      try {
        const res = await fetch("/api/onboarding", { cache: "no-store" });
        if (!res.ok) return; // auth/network blip — keep waiting
        const body = (await res.json()) as { state?: string };
        const state = body.state;
        if (!state || state === "pending") return; // still waiting
        settled.current = true;
        clearInterval(timer);
        if (state === "active") {
          setApproved(true);
          window.setTimeout(() => {
            window.location.href = "/auth/redirect";
          }, 1500);
        } else {
          // rejected / suspended / draft / no_account → re-render the right screen
          window.location.reload();
        }
      } catch {
        // network blip — keep waiting
      }
    }
    const timer = window.setInterval(check, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  if (!approved) return null;
  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-background/85 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="grid size-14 place-items-center rounded-full bg-[oklch(0.62_0.15_150/0.15)] text-[oklch(0.5_0.15_150)]">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <div className="text-[18px] font-extrabold tracking-tight text-foreground">You&apos;re approved!</div>
        <div className="text-[13.5px] text-muted-foreground">Taking you into Distribution OS…</div>
      </div>
    </div>
  );
}
