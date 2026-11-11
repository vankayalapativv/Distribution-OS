import { type ReactNode } from "react";

export interface Crumb {
  label: string;
  href?: string;
}

/** Title + subtitle + optional right-aligned action, shared by page tops.
 *  Breadcrumbs were removed app-wide; `crumbs` is still accepted (so existing
 *  callers compile) but no longer rendered. */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  readonly crumbs?: Crumb[];
  readonly title: string;
  readonly subtitle?: ReactNode;
  readonly action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-semibold">{title}</h2>
        {subtitle != null && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
