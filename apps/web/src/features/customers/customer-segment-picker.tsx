/** Customer segments — multi-select, stored comma-separated (2026-07-17). */
export const CUSTOMER_SEGMENTS = ["2W", "3W", "Car", "Commercial", "Agri"] as const;

/** Radix Select onValueChange handler that ignores a null clear (Select always
 *  has a value, but its type allows null). Curried so it can be passed inline. */
export const onTypeChange = (set: (v: string) => void) => (v: string | null) => {
  if (v) set(v);
};

/** Customer Type options — shared by the create + edit forms' Type combobox. */
export const CUSTOMER_TYPE_OPTIONS = [
  { value: "mechanic", label: "Mechanic" },
  { value: "retail", label: "Retail" },
  { value: "lof", label: "LOF" },
  { value: "industrial", label: "Industrial" },
];

/** Pill multi-select for customer segments — toggles each on/off in the parent's
 *  comma-separated segment list. */
export function CustomerSegmentPicker({
  segments,
  setSegments,
}: {
  readonly segments: string[];
  readonly setSegments: (fn: (cur: string[]) => string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {CUSTOMER_SEGMENTS.map((s) => {
        const on = segments.includes(s);
        return (
          <button
            key={s}
            type="button"
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              on
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background text-foreground hover:bg-accent"
            }`}
            onClick={() => setSegments((cur) => (on ? cur.filter((x) => x !== s) : [...cur, s]))}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}
