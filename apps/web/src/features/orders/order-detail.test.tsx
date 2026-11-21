import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { OrderDetail } from "./orders-api";
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
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
describe("OrderDetailView — Create Invoice", () => {
  test("routes to the new-invoice page for an invoiceable order", () => {
    push.mockClear();
    render(<OrderDetailView order={makeOrder()} role="SUPER_ADMIN" />);
    fireEvent.click(screen.getByRole("button", { name: /Create Invoice/ }));
    expect(push).toHaveBeenCalledWith(`/invoices/new?orderId=${makeOrder().id}`);
  });
  test("role gating: a MANAGER can't invoice (no button), an ACCOUNTANT can", () => {
    const { unmount } = render(<OrderDetailView order={makeOrder()} role="MANAGER" />);
    expect(screen.queryByRole("button", { name: /Create Invoice/ })).toBeNull();
    unmount();
    render(<OrderDetailView order={makeOrder()} role="ACCOUNTANT" />);
    expect(screen.getByRole("button", { name: /Create Invoice/ })).toBeTruthy();
  });
});
describe("OrderDetailView — customer name links to the profile", () => {
  test("the business name is a link to /dashboard/customers/{customerId}", () => {
    render(<OrderDetailView order={makeOrder()} role="SUPER_ADMIN" />);
    const link = screen.getByRole("link", { name: "Sri Laxmi Thulasi Motors" });
    expect(link.getAttribute("href")).toBe(`/customers/${CUSTOMER_ID}`);
  });
  test("the SE name is shown but is not a link", () => {
    render(<OrderDetailView order={makeOrder()} role="SUPER_ADMIN" />);
    expect(screen.getByText(/SE: Murali/)).toBeTruthy();
    // Only one link carries the customer name; the SE name is plain text.
    expect(screen.queryByRole("link", { name: /Murali/ })).toBeNull();
  });
  test("with no customerId it falls back to plain text (no link)", () => {
    render(
      <OrderDetailView
        order={makeOrder({ customerId: "", customerName: "Unlinked Co" })}
        role="SUPER_ADMIN"
      />,
    );
    expect(screen.getByText(/Unlinked Co/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Unlinked Co" })).toBeNull();
  });
  test("shows 'Unknown customer' as the link text when the name is missing", () => {
    render(<OrderDetailView order={makeOrder({ customerName: null })} role="SUPER_ADMIN" />);
    expect(screen.getByRole("link", { name: "Unknown customer" })).toBeTruthy();
  });
  test("shows 'Unknown customer' as plain text when both id and name are missing", () => {
    render(<OrderDetailView order={makeOrder({ customerId: "", customerName: null })} role="SUPER_ADMIN" />);
    expect(screen.getByText(/Unknown customer/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Unknown customer" })).toBeNull();
  });
  test("omits the SE suffix when there is no sales executive", () => {
    render(<OrderDetailView order={makeOrder({ salesExecutiveName: null })} role="SUPER_ADMIN" />);
    expect(screen.queryByText(/SE:/)).toBeNull();
  });
});
