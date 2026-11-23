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
        {/* A div, not a p: `subtitle` is ReactNode and some callers pass a
            Skeleton or other block element (a <div> inside a <p> is invalid HTML
            and causes a hydration error). */}
        {subtitle != null && <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}
