import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Uppercase alphanumeric code input (GST / PAN / Udyam Aadhar). Sanitises on
 * input to `[A-Z0-9]` (plus `-` when `allowDash`) and enforces an exact length.
 */
export function CodeField({
  label,
  name,
  length,
  placeholder,
  allowDash = false,
  containerClassName,
}: {
  readonly label: string;
  readonly name: string;
  readonly length: number;
  readonly placeholder?: string;
  readonly allowDash?: boolean;
  readonly containerClassName?: string;
}) {
  const strip = allowDash ? /[^A-Z0-9-]/g : /[^A-Z0-9]/g;
  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName ?? ""}`}>
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        placeholder={placeholder}
        className="font-mono uppercase"
        maxLength={length}
        pattern={`${allowDash ? "[A-Z0-9-]" : "[A-Z0-9]"}{${length}}`}
        title={`${label} must be ${length} characters`}
        onInput={(e) => {
          e.currentTarget.value = e.currentTarget.value.toUpperCase().replace(strip, "").slice(0, length);
        }}
      />
    </div>
  );
}
