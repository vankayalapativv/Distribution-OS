import { Bike, Car, CarTaxiFront, Tractor, Truck, type LucideIcon } from "lucide-react";

/** Customer-type code → label, shared by the Customers + Orders identity cells. */
export const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  mechanic: "Mechanic",
  retail: "Retail",
  lof: "LOF",
  industrial: "Industrial",
};

// One lucide glyph per customer segment, shown beside the name.
const SEGMENT_ICON: Record<string, LucideIcon> = {
  "2W": Bike,
  "3W": CarTaxiFront,
  Car: Car,
  Commercial: Truck,
  Agri: Tractor,
};

// Per-segment icon colour (2026-08-20). Fixed hues, same in light/dark.
const SEGMENT_COLOR: Record<string, string> = {
  "2W": "text-sky-400", // light blue
  "3W": "text-amber-500", // yellow
  Car: "text-orange-500",
  Commercial: "text-red-500",
  Agri: "text-green-600",
};

/** Coloured segment icons beside a customer name (all of a customer's segments,
 *  each with a hover tooltip). The `segment` field is comma-joined ("2W,Car").
 *  Shared by the Customers and Orders tables so both read identically. */
export function SegmentIcons({ segment }: { readonly segment: string | null }) {
  const segs = (segment ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (segs.length === 0) return null;
  return (
    <span className="flex items-center gap-1">
      {segs.map((s) => {
        const Icon = SEGMENT_ICON[s];
        return Icon ? (
          <span key={s} title={s} aria-label={s} className={SEGMENT_COLOR[s] ?? "text-muted-foreground"}>
            <Icon className="h-3.5 w-3.5" />
          </span>
        ) : null;
      })}
    </span>
  );
}
