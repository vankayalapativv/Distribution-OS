import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomerSegmentPicker } from "./customer-segment-picker";

export function splitSegments(segment: string | null): string[] {
  return (segment ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

export function last10(phone: string | null): string {
  return (phone ?? "").replace(/\D/g, "").slice(-10);
}

/** `+91` prefix + prefilled 10-digit mobile input (defaultValue-aware edit variant). */
export function PhoneEditField({ label, name, defaultValue }: { readonly label: string; readonly name: string; readonly defaultValue: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <div className="flex items-center">
        <span className="flex h-9 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
          +91
        </span>
        <Input
          id={name}
          name={name}
          type="tel"
          inputMode="numeric"
          maxLength={10}
          pattern="[0-9]{10}"
          title="Enter the 10-digit mobile number"
          className="rounded-l-none"
          defaultValue={defaultValue}
          onInput={(e) => {
            e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "").slice(0, 10);
          }}
        />
      </div>
    </div>
  );
}

/** Uppercase code input (GST/PAN/Udyam), prefilled (defaultValue-aware edit variant). */
export function CodeEditField({
  label,
  name,
  length,
  defaultValue,
  allowDash = false,
  containerClassName,
}: {
  readonly label: string;
  readonly name: string;
  readonly length: number;
  readonly defaultValue: string;
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
        defaultValue={defaultValue}
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

/** Multi-select segment chips (comma-separated in the DB). */
export function SegmentPicker({
  segments,
  setSegments,
}: {
  readonly segments: string[];
  readonly setSegments: (fn: (cur: string[]) => string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>Segment * (pick all that apply)</Label>
      <CustomerSegmentPicker segments={segments} setSegments={setSegments} />
    </div>
  );
}
