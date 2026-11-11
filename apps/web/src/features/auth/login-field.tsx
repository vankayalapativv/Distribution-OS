import type { InputHTMLAttributes } from "react";
import { TextField } from "@/components/form/text-field";

/** A login form field: labelled input plus an inline validation message. */
export function LoginField({
  label,
  name,
  error,
  ...input
}: {
  readonly label: string;
  readonly name: string;
  readonly error?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <TextField
        label={label}
        name={name}
        labelClassName="font-bold"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        {...input}
      />
      {error && (
        <p id={`${name}-error`} className="mt-1.5 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
