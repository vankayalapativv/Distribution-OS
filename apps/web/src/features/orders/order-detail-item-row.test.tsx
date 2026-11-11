import { render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { OrderItem, SkuProgress } from "./orders-api";
import { OrderDetailItemRow } from "./order-detail-item-row";

function item(over: Partial<OrderItem> = {}): OrderItem {
  return {
    id: "i1", productId: "p1", productName: "Titan GT1",     brand: "Fuchs",
    quantityUnits: 8, packSizeLitres: 5, totalLitres: 40, segment: "Car", hsnCode: null,
    ...over,
  };
}
function sku(over: Partial<SkuProgress> = {}): SkuProgress {
  return {
    orderItemId: "i1", label: "Titan", packSizeLitres: 5,
    orderedUnits: 8, cancelledUnits: 0, invoicedUnits: 8, deliveredUnits: 0, remainingUnits: 0, returnedUnits: 0,
    ...over,
  };
}

function renderRow(props: Partial<Parameters<typeof OrderDetailItemRow>[0]> = {}) {
  const row = render(
    <table>
      <tbody>
        <OrderDetailItemRow
          item={item()}
          even
          showProgress={false}
          showCancelled={false}
          showReturned={false}
          {...props}
        />
      </tbody>
    </table>,
  );
  return within(row.container.querySelector("tr")!);
}

describe("OrderDetailItemRow", () => {
  it("shows brand, segment, pack and the original qty/litres", () => {
    const r = renderRow();
    expect(r.getByText("Fuchs")).toBeInTheDocument();
    expect(r.getByText("Car")).toBeInTheDocument();
    expect(r.getByText("5 L")).toBeInTheDocument();
    expect(r.getByText("8")).toBeInTheDocument();
    expect(r.getByText("40 L")).toBeInTheDocument();
  });

  it("dashes out a missing brand, pack and litres", () => {
    const r = renderRow({ item: item({ brand: null, packSizeLitres: null, totalLitres: null }) });
    expect(r.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("shows invoiced units and a Done badge when nothing remains", () => {
    const r = renderRow({ progress: sku(), showProgress: true });
    expect(r.getByText("Done")).toBeInTheDocument();
    expect(r.getAllByText("8").length).toBeGreaterThanOrEqual(1); // qty + invoiced both 8
  });

  it("shows the remaining count when some is unfulfilled", () => {
    const r = renderRow({ progress: sku({ invoicedUnits: 5, remainingUnits: 3 }), showProgress: true });
    expect(r.getByText("3")).toBeInTheDocument();
    expect(r.queryByText("Done")).not.toBeInTheDocument();
  });

  it("shows two dashes for a row with no progress data", () => {
    const r = renderRow({ progress: undefined, showProgress: true });
    expect(r.getAllByText("—")).toHaveLength(2);
  });

  it("reflects the original qty (live + cancelled) and shows the cancelled column", () => {
    const r = renderRow({ progress: sku({ cancelledUnits: 2 }), showCancelled: true });
    expect(r.getByText("10")).toBeInTheDocument(); // 8 live + 2 cancelled
    expect(r.getByText("2")).toBeInTheDocument();
  });

  it("dashes the cancelled column when nothing was cancelled", () => {
    const r = renderRow({ progress: sku(), showCancelled: true });
    expect(r.getByText("—")).toBeInTheDocument();
  });

  it("shows returned units and dashes when none returned", () => {
    const withReturn = renderRow({ progress: sku({ returnedUnits: 4 }), showReturned: true });
    expect(withReturn.getByText("4")).toBeInTheDocument();
    const noReturn = renderRow({ progress: sku(), showReturned: true });
    expect(noReturn.getByText("—")).toBeInTheDocument();
  });

  it("dashes the segment/type column when both are missing", () => {
    const oil = renderRow({ item: item({ segment: null }) });
    expect(oil.getAllByText("—").length).toBeGreaterThanOrEqual(1);
    const filter = renderRow({ item: item({ segment: null }) });
    expect(filter.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("dashes the returned column when the row has no progress data", () => {
    const r = renderRow({ progress: undefined, showReturned: true });
    expect(r.getByText("—")).toBeInTheDocument();
  });

  it("stripes odd rows with the muted background", () => {
    const { container } = render(
      <table>
        <tbody>
          <OrderDetailItemRow item={item()} even={false} showProgress={false} showCancelled={false} showReturned={false} />
        </tbody>
      </table>,
    );
    expect(container.querySelector("tr")!.className).toContain("bg-muted/10");
  });
});
