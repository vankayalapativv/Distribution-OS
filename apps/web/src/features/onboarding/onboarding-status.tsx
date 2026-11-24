import { StatusOverlay } from "@/features/shell/status-overlay";

const STAGES: Array<{ t: string; done?: boolean; current?: boolean; wait?: boolean }> = [
  { t: "Account created", done: true },
  { t: "Company details submitted", done: true },
  { t: "Pending approval", current: true },
  { t: "Go live", wait: true },
];

function ContactFooter() {
  return (
    <div className="mt-6 border-t border-border pt-[18px] text-[12.5px] text-muted-foreground">
      Questions?{" "}
      <span className="font-semibold text-primary">vishnuvardhan@vardhansystems.in</span> · +91 63048 00595
    </div>
  );
}

export function OnboardingStatus({
  state,
  companyName,
  adminEmail,
  rejectedReason,
}: {
  state: "pending" | "rejected" | "suspended";
  companyName?: string;
  adminEmail?: string;
  rejectedReason?: string | null;
}) {
  // A suspended enterprise: a clear, non-alarming "access paused" screen — never a
  // logout / not_registered. Reactivated by the platform owner from the cockpit.
  if (state === "suspended") {
    return (
      <StatusOverlay eyebrow="Account">
        <div className="mx-auto mb-3.5 grid size-11 place-items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="7" y="5" width="3.5" height="14" rx="1.2" fill="currentColor" />
            <rect x="13.5" y="5" width="3.5" height="14" rx="1.2" fill="currentColor" />
          </svg>
        </div>
        <h1 className="text-[23px] font-extrabold tracking-tight">Account access paused</h1>
        <p className="mx-auto mt-2.5 max-w-[44ch] text-[13.5px] text-muted-foreground">
          {companyName ? `${companyName}'s` : "Your"} access to Distribution OS is currently paused. Your data is safe
          and nothing has been deleted — access resumes as soon as the account is reactivated.
        </p>
        <div className="mt-6 border-t border-border pt-[18px] text-[12.5px] text-muted-foreground">
          To restore access, please get in touch:{" "}
          <span className="font-semibold text-primary">vishnuvardhan@vardhansystems.in</span> · +91 63048 00595
        </div>
      </StatusOverlay>
    );
  }

  if (state === "rejected") {
    return (
      <StatusOverlay eyebrow="Onboarding">
        <h1 className="text-[23px] font-extrabold tracking-tight">Submission returned</h1>
        <p className="mx-auto mt-2.5 max-w-[42ch] text-[13.5px] text-muted-foreground">
          {companyName ? `${companyName}'s` : "Your"} setup needs a change before we can approve it.
        </p>
        {rejectedReason ? (
          <div className="mx-auto mt-4 max-w-[46ch] rounded-md border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-left text-[13px] text-destructive">
            {rejectedReason}
          </div>
        ) : null}
        <p className="mx-auto mt-4 max-w-[42ch] text-[13px] text-muted-foreground">
          Our team will be in touch to help you update and resubmit.
        </p>
        <ContactFooter />
      </StatusOverlay>
    );
  }

  return (
    <StatusOverlay eyebrow="Onboarding">
      <h1 className="text-[23px] font-extrabold tracking-tight">Application submitted</h1>
      <p className="mx-auto mt-2.5 max-w-[42ch] text-[13.5px] text-muted-foreground">
        Thanks{companyName ? `, ${companyName}` : ""}. We&apos;ve received your setup and it&apos;s now with our team for
        approval. You&apos;ll get an email the moment it&apos;s approved.
      </p>
      <div className="mx-auto mt-7 flex max-w-[360px] flex-col text-left">
        {STAGES.map((s, i) => (
          <div key={s.t} className="relative flex items-start gap-3.5 pb-[18px]">
            {i < STAGES.length - 1 ? (
              <span className="absolute left-3 top-[26px] bottom-[-2px] w-0.5 bg-border" />
            ) : null}
            <span
              className={`z-10 grid h-[25px] w-[25px] flex-none place-items-center rounded-full text-[12px] font-bold ${
                s.done
                  ? "bg-primary text-primary-foreground"
                  : s.current
                    ? "border-[1.5px] border-primary text-primary"
                    : "border-[1.5px] border-border bg-card text-muted-foreground"
              }`}
            >
              {i + 1}
            </span>
            <div>
              <b className="block text-[13.5px]">{s.t}</b>
              <span className="text-[12px] text-muted-foreground">
                {i === 0 ? adminEmail ?? "" : i === 1 ? "Just now" : i === 2 ? "Our team reviews and sets your plan" : "Sign in and start using Distribution OS"}
              </span>
            </div>
          </div>
        ))}
      </div>
      <ContactFooter />
    </StatusOverlay>
  );
}
