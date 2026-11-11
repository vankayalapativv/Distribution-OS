import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const useQuery = vi.fn();
vi.mock("@tanstack/react-query", () => ({ useQuery: (...a: unknown[]) => useQuery(...a) }));
vi.mock("@/lib/api-client", () => ({ apiGet: vi.fn() }));

import { OrdersFulfillmentSummary } from "./orders-fulfillment-summary";
import type { FulfillmentSummary } from "./order-fulfillment-summary-groups";

// Invoke the passed queryFn so its apiGet call is exercised, then return the stub.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockQuery = (data: unknown) => useQuery.mockImplementation((o: any) => { o.queryFn(); return { data }; });

const cfg = { apiBaseUrl: "x", authToken: "t" };
const summary = (over: Partial<FulfillmentSummary> = {}): FulfillmentSummary => ({
  ordered: 5,
  invoiced: 2,
  partiallyInvoiced: 0,
  partiallyDelivered: 0,
  delivered: 3,
  partiallyReturned: 0,
  returned: 1,
  partiallyCancelled: 0,
  cancelled: 0,
  ...over,
});

afterEach(() => {
  useQuery.mockReset();
  vi.restoreAllMocks();
});

describe("OrdersFulfillmentSummary", () => {
  it("renders nothing before the summary loads", () => {
    mockQuery(undefined);
    const { container } = render(<OrdersFulfillmentSummary actionConfig={cfg} active="" onSelect={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows only non-zero stages and their groups", () => {
    mockQuery({ summary: summary() });
    render(<OrdersFulfillmentSummary actionConfig={cfg} active="" onSelect={() => {}} />);
    // Groups with a non-zero stage appear; empty ones (Cancelled) are dropped.
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Returns")).toBeInTheDocument();
    expect(screen.queryByText("Cancelled")).not.toBeInTheDocument();
    // Ordered (5) shows; Partial inv. (0) is hidden.
    expect(screen.getByText("Ordered")).toBeInTheDocument();
    expect(screen.queryByText("Partial inv.")).not.toBeInTheDocument();
  });

  it("clicking a stage tile filters to it", () => {
    mockQuery({ summary: summary() });
    const onSelect = vi.fn();
    render(<OrdersFulfillmentSummary actionConfig={cfg} active="" onSelect={onSelect} />);
    fireEvent.click(screen.getByText("Delivered"));
    expect(onSelect).toHaveBeenCalledWith("delivered");
  });
});
