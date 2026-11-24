import { redirect } from "next/navigation";
import { getAuthToken } from "../../features/auth/server-session";
import { serverApiFetch } from "../../lib/server-api";
import { OnboardingWizard } from "../../features/onboarding/onboarding-wizard";
import { OnboardingStatus } from "../../features/onboarding/onboarding-status";
import { OnboardingStatusWatcher } from "../../features/onboarding/onboarding-status-watcher";

export const dynamic = "force-dynamic";

interface MeData {
  state: "no_account" | "draft" | "pending" | "active" | "rejected" | "suspended";
  enterprise?: { name?: string; rejectedReason?: string | null } | null;
  draft?: { payload?: Record<string, unknown>; currentStep?: number } | null;
}

export default async function OnboardingPage() {
  const token = await getAuthToken();
  if (!token) redirect("/login");

  let me: MeData = { state: "no_account" };
  try {
    const res = await serverApiFetch("/onboarding/me", {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) me = ((await res.json()) as { data: MeData }).data;
  } catch {
    // fall through — treat as a fresh draft
  }

  if (me.state === "active") redirect("/auth/redirect");

  if (me.state === "pending") {
    // The watcher polls status and auto-enters the app on approval (or re-renders
    // on rejection/suspension) — no manual refresh needed.
    return (
      <>
        <OnboardingStatus state="pending" companyName={me.enterprise?.name} />
        <OnboardingStatusWatcher />
      </>
    );
  }
  if (me.state === "rejected") {
    return (
      <OnboardingStatus
        state="rejected"
        companyName={me.enterprise?.name}
        rejectedReason={me.enterprise?.rejectedReason ?? null}
      />
    );
  }
  if (me.state === "suspended") {
    return <OnboardingStatus state="suspended" companyName={me.enterprise?.name} />;
  }

  // draft / no_account → the wizard
  const initial = me.draft?.payload
    ? { ...(me.draft.payload as Record<string, unknown>), currentStep: me.draft.currentStep ?? 0 }
    : null;
  return <OnboardingWizard initial={initial as never} />;
}
