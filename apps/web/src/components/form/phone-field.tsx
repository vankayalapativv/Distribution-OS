import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** `+91` prefix + a 10-digit-only mobile input. Submit value is the 10 digits. */
export function PhoneField({
  label,
  name,
  required,
  placeholder = "9876543210",
}: {
  readonly label: string;
  readonly name: string;
  readonly required?: boolean;
  readonly placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>
        {label}
        {required ? " *" : ""}
      </Label>
      <div className="flex items-center">
        <span className="flex h-9 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
          +91
        </span>
        <Input
          id={name}
          name={name}
          type="tel"
          inputMode="numeric"
          placeholder={placeholder}
          maxLength={10}
          pattern="[0-9]{10}"
          title="Enter the 10-digit mobile number"
          className="rounded-l-none"
          required={required}
          onInput={(e) => {
            e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "").slice(0, 10);
          }}
        />
      </div>
    </div>
  );
}
