/** Section label — matches the New-Order dialog's uppercase muted style. */
export function FieldLabel({ children, required }: { readonly children: React.ReactNode; readonly required?: boolean }) {
  return (
    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {children}
      {required ? <span className="text-destructive"> *</span> : null}
    </span>
  );
}
