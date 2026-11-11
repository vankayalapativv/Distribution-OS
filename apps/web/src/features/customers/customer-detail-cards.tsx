import type { ReactNode } from "react";

/** One labeled read-only value; renders an em dash when the value is null. */
export function Field({ label, value }: { readonly label: string; readonly value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-sm">{value ?? "—"}</p>
    </div>
  );
}

/** One section's info card: a titled panel with a compact 2-column field grid.
 *  Kept dense (tight padding) so all five stack on one screen — the client wants
 *  the whole profile without scrolling. */
export function InfoCard({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-white px-5 py-3 shadow-sm">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">{children}</div>
    </div>
  );
}
