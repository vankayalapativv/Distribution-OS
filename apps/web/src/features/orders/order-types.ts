/** A single invoice reference on an order (for the list's click-to-open links). */
export interface OrderInvoiceRef {
  id: string;
  number: string;
  /** Invoice date (ISO). Null on older API responses that predate this field. */
  date: string | null;
}

export interface OrderItem {
  id: string;
  productId: string | null;
  productName: string | null;
  brand: string | null;
  quantityUnits: number;
  packSizeLitres: number | null;
  totalLitres: number | null;
  segment: string | null;
  hsnCode: string | null;
}

export interface SalesExecutive {
  id: string;
  name: string;
}

export interface Order {
  id: string;
  orderCode: string;
  orderDate: string;
  customerId: string;
  customerName: string | null;
  addressCity: string | null;
  customerPhone: string | null;
  segment: string | null;
  customerType: string | null;
  salesExecutiveId: string | null;
  salesExecutiveName: string | null;
  orderStatus: string;
  approvalStatus: string;
  // "standard" = placed in the field/web; "invoice" = auto-created behind a
  // directly-generated invoice (shown with a "From invoice" badge in the list).
  origin: string;
  discountAmount: number | null;
  totalTaxableAmount: number | null;
  totalGstAmount: number | null;
  totalInvoiceValue: number | null;
  totalLitres: number | null;
  deliveryAddress: string | null;
  deliveryNotes: string | null;
  remarks: string | null;
  createdBy: string | null;
  /** Fulfillment: the linked invoice (null = not invoiced) and its delivery. */
  invoiceId: string | null;
  invoiceCode: string | null;
  /** Earliest invoice's number + total invoice count for the order (paged list). */
  firstInvoiceNumber: string | null;
  invoiceCount: number;
  /** Every invoice on the order (earliest first) — so the list can open each PDF. */
  invoices: OrderInvoiceRef[];
  delivered: boolean;
  /** Computed ladder over all of the order's invoices/deliveries (paged list).
   *  A cancelled order reports "cancelled" regardless of its invoice state. */
  fulfillmentStatus:
    | "ordered"
    | "partially_invoiced"
    | "invoiced"
    | "partially_delivered"
    | "delivered"
    | "partially_returned"
    | "returned"
    | "partially_cancelled"
    | "cancelled"
    | null;
  /** Units + litres returned via sales returns (paged list; 0 elsewhere). */
  returnedUnits: number;
  returnedLitres: number;
  /** True when nothing is left to bill — hides "Create Invoice". */
  fullyInvoiced: boolean;
  /** Ordered line items (per-SKU) — populated by the paged list for the export;
   *  [] on other list endpoints. OrderDetail re-declares it as always present. */
  items: OrderItem[];
  createdAt: string;
}
