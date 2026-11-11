"use client";

/**
 * One field-level validation message, shown only once its field has been
 * touched. `id` ties it to the control via aria-describedby; role="alert" means
 * screen readers announce it when it appears.
 */
export function FieldError({ id, show, message }: { readonly id: string; readonly show: boolean; readonly message?: string }) {
  if (!show || !message) return null;
  return (
    <p id={id} role="alert" className="text-xs font-medium text-destructive">
      {message}
    </p>
  );
}

/** aria props for a control whose field has a (shown) error. The Input component
 *  already paints a destructive border/ring from `aria-invalid`, so this just
 *  wires the state + the describedby link. */
export function fieldErrorProps(id: string, show: boolean, message?: string) {
  const invalid = Boolean(show && message);
  return {
    "aria-invalid": invalid || undefined,
    "aria-describedby": invalid ? id : undefined,
  };
}
