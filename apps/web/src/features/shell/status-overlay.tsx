import type { ReactNode } from "react";

/**
 * Shared full-screen shell for the account-status screens (onboarding pending /
 * rejected, and suspended). An elevated, frosted card floats on the app's blue
 * brand gradient — the same "payment-reminder overlay" feel, but with the brand
 * backdrop (not dashboard chrome), which suits a user who has no dashboard yet.
 * The gradient is a fixed brand color; the card and its text use theme tokens.
 */
export function StatusOverlay({ eyebrow = "Account", children }: { eyebrow?: string; children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden text-foreground">
      {/* Brand gradient backdrop (matches the signup page's left panel) */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ backgroundColor: "#2751b8", backgroundImage: "linear-gradient(155deg, #2751b8 0%, #3a81f5 62%, #59a0f9 100%)" }}
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(520px 360px at 85% 6%, rgba(255,255,255,0.20), transparent 60%), radial-gradient(460px 380px at 0% 100%, rgba(255,255,255,0.14), transparent 60%)",
        }}
      />

      {/* Brand mark */}
      <div className="absolute left-6 top-5 flex items-center gap-2 text-white">
        <span className="text-[15px] font-extrabold tracking-tight">Distribution&nbsp;OS</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">{eyebrow}</span>
      </div>

      {/* Centered elevated card */}
      <div className="relative grid min-h-screen place-items-center p-4">
        <div className="w-full max-w-[560px] rounded-2xl border border-white/15 bg-card p-8 text-center shadow-2xl sm:p-9">
          {children}
        </div>
      </div>
    </div>
  );
}
