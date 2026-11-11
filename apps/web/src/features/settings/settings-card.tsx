"use client";

import type { ReactNode } from "react";

/** A rich settings card: an icon chip + title (+ description) header with an
 *  optional action on the right, then a body. Used for the always-visible
 *  Company sections (R2 "hero profile" layout — no collapsing). */
export function SectionCard({
  icon, title, description, action, children,
}: Readonly<{
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}>) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-3 px-5 py-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-primary/10 text-primary">{icon}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      <div className="px-5 pb-5">{children}</div>
    </section>
  );
}
