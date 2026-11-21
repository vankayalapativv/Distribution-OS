import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const props = vi.fn();
vi.mock("./order-oil-lines", () => ({
  OrderOilLines: (p: unknown) => { props(p); return <div>oil-lines</div>; },
}));

import { OrderLineItemsTabs } from "./order-line-items-tabs";

describe("OrderLineItemsTabs", () => {
  it("forwards the draft's oil-line state + handlers to OrderOilLines", () => {
    const draft = {
      lineItems: [{ id: 1 }], productSearches: ["x"], productPopoverOpen: [false],
      registerProductSearchInput: vi.fn(), updateLineItem: vi.fn(), addLineItem: vi.fn(),
      removeLineItem: vi.fn(), openProductPopover: vi.fn(), closeProductPopover: vi.fn(),
      selectProduct: vi.fn(), productSearchChange: vi.fn(),
    };
    render(<OrderLineItemsTabs draft={draft as never} products={[{ id: "p1" }] as never} />);
    expect(screen.getByText("oil-lines")).toBeInTheDocument();
    const p = props.mock.calls[0][0] as Record<string, unknown>;
    expect(p.lineItems).toBe(draft.lineItems);
    expect(p.onAddLineItem).toBe(draft.addLineItem);
    expect(p.onSelectProduct).toBe(draft.selectProduct);
    expect(p.products).toEqual([{ id: "p1" }]);
  });
});
