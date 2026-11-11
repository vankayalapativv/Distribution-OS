import type { Product } from "./orders-api";
import type { ActionConfig } from "@/lib/api-client";

/** The subset of an order needed to pre-fill the form for editing. */
export interface EditableOrder {
  id: string;
  customerId: string;
  /** Customer name — shown in the picker when editing (may be outside seedItems). */
  customerName?: string | null;
  salesExecutiveId: string | null;
  orderDate: string | null;
  items: {
    /** order_items.id — set for existing lines; drives partial-edit updates. */
    orderItemId?: string | null;
    productId: string | null;
    quantityUnits: number;
    packSizeLitres: number | null;
    segment: string | null;
    /** Brand (company) of the line, carried for the locked-lines display. */
    brand?: string | null;
    /** Units already billed on this line (partial delivery). >0 ⇒ locked line. */
    invoicedUnits?: number;
    /** Units on a DELIVERED invoice. >0 ⇒ the line is read-only (goods shipped). */
    deliveredUnits?: number;
    /** Display name for the locked-lines editor. */
    label?: string;
  }[];
}

/** A line that's already (partly) invoiced. If NOT yet delivered, its quantity is
 *  editable down to the billed amount; once DELIVERED it's fully read-only. Either
 *  way the line can't be removed or its product changed. */
export interface LockedLine {
  orderItemId: string;
  /** SKU / product name. */
  label: string;
  /** Brand (company), segment and pack size — shown to match the actual order. */
  brand: string | null;
  segment: string | null;
  packSizeLitres: number | null;
  invoicedUnits: number;
  /** Units on a delivered invoice; >0 ⇒ those units are read-only. */
  deliveredUnits: number;
  /** The ORIGINAL ordered quantity at open time (immutable). Decides whether this
   *  line has an un-invoiced remainder to edit — fixed, so clearing the remainder
   *  field to 0 can't make the editor row vanish mid-edit. */
  orderedUnits: number;
  /** Total quantity (string for the input): the committed (invoiced) units plus the
   *  edited remainder; never below invoicedUnits. */
  quantityUnits: string;
}

export interface UseOrderDraftArgs {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  actionConfig: ActionConfig;
  /** When set, the dialog edits this order instead of creating a new one. */
  order?: EditableOrder | null;
  /** Pre-select this customer when creating (e.g. from a customer's page). */
  initialCustomerId?: string;
  /** Called after a successful create/update (in addition to the ["orders"] invalidation). */
  onCreated?: () => void;
}
