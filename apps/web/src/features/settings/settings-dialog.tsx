"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CreditCard,
  Lock,
  LogOut,
  Plug,
  Search,
  SlidersHorizontal,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import type { ActionConfig } from "@/lib/api-client";
import { BillingCardV2 } from "@/features/billing/billing-card-v2";
import type { BillingAccessV2, BillingChargeV2 } from "@/features/billing/billing-v2-api";
import { PanelHeader, type SettingsRole, type SystemSettings, type UserProfile } from "./settings-shared";
import { AccountPanel } from "./settings-profile";
import { SecurityPanel } from "./settings-security";
import { CompanyPanel } from "./settings-company";
import { RulesPanel } from "./settings-rules";
import { McpPanel } from "./settings-mcp";

type SectionKey = "account" | "security" | "company" | "billing" | "rules" | "mcp";

interface SettingsDialogProps {
  readonly role: SettingsRole;
  readonly profile: UserProfile;
  readonly systemSettings: SystemSettings | null;
  readonly actionConfig: ActionConfig;
  readonly billingAccess?: BillingAccessV2 | null;
  readonly billingCharges?: BillingChargeV2[];
  readonly checkoutReturn?: "success" | "failed" | null;
  readonly initialTab?: string;
  readonly closeHref: string;
  /** "back" pops the intercepted /settings URL, revealing the page behind it;
   *  "href" navigates to closeHref (used on a hard load with no history). */
  readonly dismissMode?: "back" | "href";
}

export function SettingsDialog({
  role,
  profile,
  systemSettings,
  actionConfig,
  billingAccess = null,
  billingCharges = [],
  checkoutReturn = null,
  initialTab,
  closeHref,
  dismissMode = "href",
}: SettingsDialogProps) {
  const router = useRouter();

  const sections = useMemo(
    () =>
      (
        [
          { key: "account", label: "Account", Icon: User, show: true },
          { key: "security", label: "Security", Icon: Lock, show: true },
          { key: "company", label: "Company", Icon: Building2, show: role === "SUPER_ADMIN" && !!systemSettings },
          { key: "billing", label: "Billing", Icon: CreditCard, show: role === "SUPER_ADMIN" && !!billingAccess },
          { key: "rules", label: "Business Rules", Icon: SlidersHorizontal, show: role === "SUPER_ADMIN" && !!systemSettings },
          { key: "mcp", label: "MCP", Icon: Plug, show: role === "SUPER_ADMIN" },
        ] as Array<{ key: SectionKey; label: string; Icon: LucideIcon; show: boolean }>
      ).filter((s) => s.show),
    [role, systemSettings, billingAccess],
  );

  const keys = sections.map((s) => s.key);
  const preferred = (checkoutReturn ? "billing" : (initialTab as SectionKey)) ?? "account";
  const [active, setActive] = useState<SectionKey>(keys.includes(preferred) ? preferred : "account");
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? sections.filter((s) => s.label.toLowerCase().includes(query.trim().toLowerCase()))
    : sections;

  const close = () => (dismissMode === "back" ? router.back() : router.push(closeHref));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={close}
      role="button" tabIndex={0} aria-label="Close"
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " " || e.key === "Escape") close(); }}>
      <div
        className="flex h-[min(90vh,680px)] w-full max-w-[920px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:flex-row"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        {/* Left rail */}
        <aside className="flex shrink-0 flex-col gap-1 border-b border-border bg-muted/40 p-3 sm:w-60 sm:border-b-0 sm:border-r sm:p-4">
          <div className="mb-2 flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-2.5 text-muted-foreground">
            <Search size={15} className="shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search settings"
              aria-label="Search settings"
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <p className="px-2 pb-1 pt-1 text-[11px] font-semibold tracking-wider text-muted-foreground">SETTINGS</p>
          <nav className="flex gap-1 overflow-x-auto sm:flex-col sm:overflow-visible">
            {filtered.map((s) => (
              <button
                key={s.key}
                onClick={() => setActive(s.key)}
                className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active === s.key
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <s.Icon size={16} />
                {s.label}
              </button>
            ))}
          </nav>
          <div className="mt-auto hidden pt-2 sm:block">
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                <LogOut size={16} />
                Sign out
              </button>
            </form>
          </div>
        </aside>

        {/* Right panel */}
        <section className="relative min-w-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8">
          <button
            onClick={close}
            aria-label="Close settings"
            className="absolute right-4 top-4 grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X size={16} />
          </button>

          {active === "account" && <AccountPanel role={role} profile={profile} actionConfig={actionConfig} />}
          {active === "security" && <SecurityPanel />}
          {active === "company" && systemSettings && (
            <CompanyPanel company={systemSettings.company} actionConfig={actionConfig} />
          )}
          {active === "billing" && billingAccess && (
            <>
              <PanelHeader title="Billing" subtitle="Monthly payment, billed for all active users." />
              <BillingCardV2 initialAccess={billingAccess} initialCharges={billingCharges} actionConfig={actionConfig} />
            </>
          )}
          {active === "rules" && systemSettings && (
            <RulesPanel systemSettings={systemSettings} actionConfig={actionConfig} />
          )}
          {active === "mcp" && <McpPanel actionConfig={actionConfig} />}
        </section>
      </div>
    </div>
  );
}
