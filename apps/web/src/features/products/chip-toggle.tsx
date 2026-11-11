/** Segments a product may belong to — must match the API's ALLOWED_SEGMENTS. */
export const PRODUCT_SEGMENTS = [
  "Car",
  "2W",
  "3W",
  "Commercial",
  "Agri",
  "Gear Oil",
  "Coolant",
  "Grease",
] as const;

/** A toggleable pill used for the multi-select Segment / Pack Size groups. */
export function ChipToggle({
  label,
  on,
  onClick,
}: {
  readonly label: string;
  readonly on: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
        on
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background text-foreground hover:bg-accent"
      }`}
    >
      {label}
    </button>
  );
}
