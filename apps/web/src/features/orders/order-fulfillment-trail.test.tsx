import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { OrderDetail, Shipment, SkuProgress } from "./orders-api";
import { FulfillmentTrail } from "./order-fulfillment-trail";

function ship(over: Partial<Shipment> = {}): Shipment {
  return {
    id: "s1", code: "INV-1", date: "2026-08-01", total: 0, outstanding: 0,
    oilLitres: 10, invoicedAt: "2026-08-01T00:00:00Z", delivered: false, deliveredAt: null,
    ...over,
  };
}
function sku(over: Partial<SkuProgress> = {}): SkuProgress {
  return {
    orderItemId: "i1", label: "Titan", packSizeLitres: 1,
    orderedUnits: 10, cancelledUnits: 0, invoicedUnits: 10, remainingUnits: 0, returnedUnits: 0,
    ...over,
  };
}
const order = (over: Partial<OrderDetail> = {}) =>
  ({ createdAt: "2026-08-01T08:00:00Z", shipments: [], skuProgress: [], ...over }) as unknown as OrderDetail;

describe("FulfillmentTrail", () => {
  it("always shows the created node and the current stage badge", () => {
    render(<FulfillmentTrail order={order()} />);
    expect(screen.getByText("Order created")).toBeInTheDocument();
    expect(screen.getByText("Ordered")).toBeInTheDocument();
  });

  it("shows a 'Not invoiced yet' node when there are no shipments", () => {
    render(<FulfillmentTrail order={order()} />);
    expect(screen.getByText("Not invoiced yet")).toBeInTheDocument();
  });

  it("renders a node per shipment", () => {
    render(<FulfillmentTrail order={order({ shipments: [ship()], skuProgress: [sku()] })} />);
    expect(screen.getByText("INV-1")).toBeInTheDocument();
    // "Invoiced" appears as both the shipment label and the stage badge.
    expect(screen.getAllByText("Invoiced").length).toBeGreaterThanOrEqual(1);
  });

  it("lists SKUs awaiting invoicing with pluralisation", () => {
    render(
      <FulfillmentTrail
        order={order({ shipments: [ship()], skuProgress: [sku({ invoicedUnits: 6, remainingUnits: 4 })] })}
      />,
    );
    expect(screen.getByText(/Awaiting 1 SKU to invoice/)).toBeInTheDocument();
    expect(screen.getByText(/Titan \(4 left\)/)).toBeInTheDocument();
  });

  it("lists short-closed SKUs", () => {
    render(<FulfillmentTrail order={order({ shipments: [ship()], skuProgress: [sku({ cancelledUnits: 2 })] })} />);
    expect(screen.getByText(/Cancelled the un-invoiced remainder of 1 SKU/)).toBeInTheDocument();
    expect(screen.getByText(/Titan \(2 cancelled\)/)).toBeInTheDocument();
  });

  it("pluralises multiple remaining and cancelled SKUs", () => {
    const two = [
      sku({ orderItemId: "i1", label: "A", invoicedUnits: 1, remainingUnits: 2 }),
      sku({ orderItemId: "i2", label: "B", invoicedUnits: 1, remainingUnits: 3 }),
    ];
    const { rerender } = render(<FulfillmentTrail order={order({ shipments: [ship()], skuProgress: two })} />);
    expect(screen.getByText(/Awaiting 2 SKUs to invoice/)).toBeInTheDocument();
    rerender(
      <FulfillmentTrail
        order={order({
          shipments: [ship()],
          skuProgress: [sku({ label: "A", cancelledUnits: 1 }), sku({ orderItemId: "i2", label: "B", cancelledUnits: 1 })],
        })}
      />,
    );
    expect(screen.getByText(/remainder of 2 SKUs/)).toBeInTheDocument();
  });

  it("tolerates missing shipments/skuProgress arrays", () => {
    render(<FulfillmentTrail order={{ createdAt: "2026-08-01T08:00:00Z" } as unknown as OrderDetail} />);
    expect(screen.getByText("Not invoiced yet")).toBeInTheDocument();
    expect(screen.getByText("Ordered")).toBeInTheDocument();
  });

  it("treats a progress row with no cancelledUnits field as not cancelled", () => {
    const partial = { orderItemId: "i1", label: "A", invoicedUnits: 1, remainingUnits: 0 } as unknown as SkuProgress;
    render(<FulfillmentTrail order={order({ shipments: [ship()], skuProgress: [partial] })} />);
    expect(screen.queryByText(/Cancelled the un-invoiced remainder/)).not.toBeInTheDocument();
  });
});
