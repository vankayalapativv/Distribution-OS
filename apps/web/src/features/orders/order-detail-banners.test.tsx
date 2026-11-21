import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { OrderDetail } from "./orders-api";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
import { OrderDetailView } from "./order-detail";
const CUSTOMER_ID = "23982876-3e3e-4213-baad-bfaf7e188c6c";
function makeOrder(overrides: Partial<OrderDetail> = {}): OrderDetail {
  return {
    id: "d4b98edd-0003-487c-8411-3294bd74b125", orderCode: "ORD-0090", orderDate: "2026-08-01",
    customerId: CUSTOMER_ID, customerName: "Sri Laxmi Thulasi Motors", addressCity: null, segment: null,
    customerType: null, customerPhone: null, salesExecutiveId: "se-1", salesExecutiveName: "Murali",
    orderStatus: "pending", approvalStatus: "pending", origin: "standard", discountAmount: null,
    totalTaxableAmount: null, totalGstAmount: null, totalInvoiceValue: null, totalLitres: 40,
    deliveryAddress: null, deliveryNotes: null, remarks: null, cancellationNote: null, createdBy: null,
    invoiceId: null, invoiceCode: null, firstInvoiceNumber: null, invoiceCount: 0, invoices: [],
    delivered: false, fulfillmentStatus: "ordered", returnedUnits: 0, returnedLitres: 0, fullyInvoiced: false,
    createdAt: "2026-08-01T08:10:00.000Z", items: [], fulfillment: { invoice: null, delivery: null },
    shipments: [], skuProgress: [], ...overrides,
  };
}

describe("OrderDetailView — cancellation reason banner", () => {
  test("a cancelled order with a note shows the reason", () => {
    render(<OrderDetailView order={makeOrder({ orderStatus: "cancelled", cancellationNote: "Duplicate order" })} role="SUPER_ADMIN" />);
    expect(screen.getByText("Order cancelled")).toBeTruthy();
    expect(screen.getByText(/Duplicate order/)).toBeTruthy();
  });
  test("a cancelled order without a note says none was recorded", () => {
    render(<OrderDetailView order={makeOrder({ orderStatus: "cancelled", cancellationNote: null })} role="SUPER_ADMIN" />);
    expect(screen.getByText("Order cancelled")).toBeTruthy();
    expect(screen.getByText(/No reason was recorded/)).toBeTruthy();
  });
  test("a non-cancelled order shows no cancellation banner", () => {
    render(<OrderDetailView order={makeOrder()} role="SUPER_ADMIN" />);
    expect(screen.queryByText("Order cancelled")).toBeNull();
  });
  test("a short-closed order shows the partial-cancellation banner", () => {
    render(
      <OrderDetailView
        order={makeOrder({
          skuProgress: [
            { orderItemId: "i1", label: "Oil", packSizeLitres: 1, orderedUnits: 4, cancelledUnits: 2, invoicedUnits: 2, deliveredUnits: 0, remainingUnits: 0, returnedUnits: 0 },
          ],
        })}
        role="SUPER_ADMIN"
      />,
    );
    expect(screen.getByText(/short-closed/)).toBeInTheDocument();
  });
});
