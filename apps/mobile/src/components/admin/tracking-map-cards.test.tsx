import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CheckinCard, CustomerCard } from "./tracking-map-cards";
import type { CheckinMarker, DuesBand, MapCustomer } from "../../lib/admin-tracking";

const bands: DuesBand[] = [{ key: "0", ordinal: 0, fromDays: 0, toDays: 30, label: "0–30 days" }];

const customer = (over: Partial<MapCustomer> = {}): MapCustomer =>
  ({
    id: "c1",
    name: "Acme Traders",
    code: "C1",
    city: "Hyderabad",
    executiveName: "Asha",
    outstanding: 12000,
    bucket: "0",
    lastOrderDays: 3,
    lastCollectionDays: 10,
    ...over,
  }) as MapCustomer;

describe("CustomerCard", () => {
  it("shows the dues line + chips, opens the customer, and closes", () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();
    render(<CustomerCard customer={customer()} bands={bands} onOpen={onOpen} onClose={onClose} />);
    expect(screen.getByText("Acme Traders")).toBeInTheDocument();
    expect(screen.getByText("Hyderabad · Asha")).toBeInTheDocument();
    expect(screen.getByText(/0–30 days/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Acme Traders"));
    expect(onOpen).toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows 'No dues' and hides meta when there is nothing outstanding / no city+exec", () => {
    render(
      <CustomerCard customer={customer({ outstanding: 0, city: null, executiveName: null })} bands={bands} onOpen={() => {}} onClose={() => {}} />,
    );
    expect(screen.getByText("No dues")).toBeInTheDocument();
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
  });
});

const checkin = (over: Partial<CheckinMarker> = {}): CheckinMarker =>
  ({
    id: "k1",
    customerName: "Acme Traders",
    checkInAt: "2026-11-27T04:00:00Z",
    planned: "planned",
    orders: [{ id: "o1", code: "ORD-1", litres: 20 }],
    collections: [{ id: "cl1", code: "RCP-1", amount: 5000 }],
    ...over,
  }) as CheckinMarker;

describe("CheckinCard", () => {
  it("renders a planned visit with its orders and collections", () => {
    const onOpen = vi.fn();
    render(<CheckinCard checkin={checkin()} onOpen={onOpen} onClose={() => {}} />);
    expect(screen.getByText("Planned visit")).toBeInTheDocument();
    expect(screen.getByText("ORD-1")).toBeInTheDocument();
    expect(screen.getByText("20 L")).toBeInTheDocument();
    expect(screen.getByText("RCP-1")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Acme Traders"));
    expect(onOpen).toHaveBeenCalled();
  });

  it("renders an unplanned visit with the empty order/collection states", () => {
    render(<CheckinCard checkin={checkin({ planned: "unplanned", orders: [], collections: [], checkInAt: null })} onOpen={() => {}} onClose={() => {}} />);
    expect(screen.getByText("Unplanned visit")).toBeInTheDocument();
    expect(screen.getByText("No orders")).toBeInTheDocument();
    expect(screen.getByText("No collections")).toBeInTheDocument();
  });
});
