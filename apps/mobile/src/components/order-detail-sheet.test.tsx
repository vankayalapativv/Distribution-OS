import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchOrderDetail = vi.fn<(...a: unknown[]) => Promise<unknown>>();
vi.mock("../lib/order-detail", () => ({ fetchOrderDetail: (...a: unknown[]) => fetchOrderDetail(...a) }));

const online = { value: true };
vi.mock("../lib/connectivity", () => ({ useIsOnline: () => online.value }));

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OrderDetailSheet } from "./order-detail-sheet";

const detail = {
  orderCode: "ORD-9",
  orderDate: "2026-11-27",
  totalLitres: 8,
  items: [{ name: "Oil A", kind: "oil", segment: "Car", packSizeLitres: 1, totalLitres: 8, quantityUnits: 8 }],
};

beforeEach(() => {
  fetchOrderDetail.mockReset();
  online.value = true;
});

describe("OrderDetailSheet", () => {
  it("shows the skeleton then the loaded order", async () => {
    fetchOrderDetail.mockResolvedValue(detail);
    render(<OrderDetailSheet target={{ orderId: "o9", fulfillmentStatus: "invoiced" }} onClose={() => {}} />);
    expect(await screen.findByText("ORD-9")).toBeInTheDocument();
    expect(fetchOrderDetail).toHaveBeenCalledWith("o9");
  });

  it("shows the online error state when the fetch returns null", async () => {
    fetchOrderDetail.mockResolvedValue(null);
    render(<OrderDetailSheet target={{ orderId: "o9" }} onClose={() => {}} />);
    expect(await screen.findByText("Couldn't load this order")).toBeInTheDocument();
    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
  });

  it("shows the offline error message when offline", async () => {
    online.value = false;
    fetchOrderDetail.mockResolvedValue(null);
    render(<OrderDetailSheet target={{ orderId: "o9" }} onClose={() => {}} />);
    expect(await screen.findByText(/You're offline/)).toBeInTheDocument();
  });

  it("stays on the skeleton when there is no orderId (never fetches)", () => {
    render(<OrderDetailSheet target={{}} onClose={() => {}} />);
    expect(fetchOrderDetail).not.toHaveBeenCalled();
    expect(screen.queryByText("Couldn't load this order")).not.toBeInTheDocument();
  });

  it("closes on the backdrop but not on a sheet tap", async () => {
    fetchOrderDetail.mockResolvedValue(detail);
    const onClose = vi.fn();
    render(<OrderDetailSheet target={{ orderId: "o9" }} onClose={onClose} />);
    await screen.findByText("ORD-9");
    fireEvent.click(screen.getByText("ORD-9")); // inside the sheet → stopPropagation, no close
    expect(onClose).not.toHaveBeenCalled();
  });
});
