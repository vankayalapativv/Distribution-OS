const STAGES: Array<{ t: string; done?: boolean; current?: boolean; wait?: boolean }> = [
  { t: "Account created", done: true },
  { t: "Company details submitted", done: true },
  { t: "Pending approval", current: true },
  { t: "Go live", wait: true },
];

export function OnboardingStatus({
  state,
  companyName,
  adminEmail,
  rejectedReason,
}: {
  state: "pending" | "rejected";
  companyName?: string;
  adminEmail?: string;
  rejectedReason?: string | null;
}) {
  const rejected = state === "rejected";
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center gap-2 border-b border-border px-5 py-3">
        <span className="text-[15px] font-extrabold tracking-tight">Distribution&nbsp;OS</span>
        <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Onboarding</span>
      </header>

      <main className="px-4 py-8">
        <div className="mx-auto max-w-[560px]">
          <div className="rounded-[10px] border border-border bg-card p-8 text-center shadow-sm sm:p-9">
            {rejected ? (
              <>
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
              </>
            ) : (
              <>
                <h1 className="text-[23px] font-extrabold tracking-tight">Application submitted</h1>
                <p className="mx-auto mt-2.5 max-w-[42ch] text-[13.5px] text-muted-foreground">
                  Thanks{companyName ? `, ${companyName}` : ""}. We've received your setup and it's now with our team for
                  approval. You'll get an email the moment it's approved.
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
              </>
            )}
            <div className="mt-6 border-t border-border pt-[18px] text-[12.5px] text-muted-foreground">
              Questions?{" "}
              <span className="font-semibold text-primary">vishnuvardhan@vardhansystems.in</span> · +91 63048 00595
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
