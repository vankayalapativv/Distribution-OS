import type { ReactNode } from "react";
import { isWebRole, requireSessionRole } from "@/features/auth/auth-role";
import { BillingBlockedScreen } from "@/features/billing/billing-blocked-screen";
import { BillingGuardV2 } from "@/features/billing/billing-guard-v2";
import { loadBillingAccess } from "@/features/billing/billing-v2-api";
import { PopupLinkRouter } from "@/features/shell/popup-link-router";

export const dynamic = "force-dynamic";

/**
 * Dashboard layout + Billing v2 gate (standard monthly seat-based payments).
 *
 * When billing is BLOCKED and enforcement is ON, we render a clean, server-side
 * "Payment required" screen INSTEAD of the app — so no page data is fetched and
 * the user never sees a 402 error page. Otherwise the app renders normally inside
 * BillingGuardV2 (the non-blocking grace banner, and a live block if billing
 * lapses while browsing). The server 402 gate is the real enforcement; this is
 * the UX. Access is read server-side; a read failure leaves `access` null so the
 * app still renders (fail-open). Auth is enforced here (and by each page).
 */
export default async function DashboardLayout({
  children,
  modal,
}: {
  readonly children: ReactNode;
  /** Parallel slot for the intercepted Settings dialog (see @modal). */
  readonly modal: ReactNode;
}) {
  const auth = await requireSessionRole(); // keep the login redirect at the layout level
  const { access, actionConfig } = await loadBillingAccess();

  // Hard block: render only the payment screen (no app, no data fetch, no 402).
  // `role` draws a static, inert dashboard chrome behind the card.
  if (access?.blocked && access.enforced) {
    return (
      <BillingBlockedScreen
        initial={access}
        actionConfig={actionConfig}
        role={isWebRole(auth.role) ? auth.role : undefined}
      />
    );
  }

  return (
    <BillingGuardV2 initial={access} actionConfig={actionConfig}>
      {/* Routes internal links inside Leaflet map popups through the SPA router. */}
      <PopupLinkRouter />
      {children}
      {modal}
    </BillingGuardV2>
  );
}
