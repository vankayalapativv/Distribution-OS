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
    /** Units already billed on this line (partial delivery). >0 ⇒ locked line. */
    invoicedUnits?: number;
    /** Display name for the locked-lines editor. */
    label?: string;
  }[];
}

/** A line that's already (partly) invoiced: its quantity is editable down to the
 *  billed amount, but the line can't be removed or its product changed. */
export interface LockedLine {
  orderItemId: string;
  label: string;
  invoicedUnits: number;
  /** Editable total quantity (string for the input); never below invoicedUnits. */
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
