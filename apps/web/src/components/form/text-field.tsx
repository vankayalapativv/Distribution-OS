import type { InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/form/password-input";
import { Label } from "@/components/ui/label";

/** Label + Input in a labelled column. Forwards any native input attribute.
 *  Password fields automatically get a show/hide eye toggle. */
export function TextField({
  label,
  name,
  containerClassName,
  labelClassName,
  ...input
}: {
  readonly label: string;
  readonly name: string;
  readonly containerClassName?: string;
  readonly labelClassName?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  const Field = input.type === "password" ? PasswordInput : Input;
  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName ?? ""}`}>
      <Label htmlFor={name} className={labelClassName}>
        {label}
        {input.required ? " *" : ""}
      </Label>
      <Field id={name} name={name} {...input} />
    </div>
  );
}
