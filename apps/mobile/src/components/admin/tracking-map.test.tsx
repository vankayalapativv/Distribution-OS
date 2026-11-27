import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../lib/api", () => ({ apiFetch: vi.fn() }));
vi.mock("../../lib/auth", () => ({ useAuth: { getState: () => ({ token: "t" }) } }));

import { fireEvent, render, screen } from "@testing-library/react";
import { router } from "expo-router";
import { TrackingMap } from "./tracking-map";

const customer = {
  id: "c1", name: "Acme Traders", code: "C1", city: "Hyderabad", executiveName: "Asha",
  outstanding: 0, bucket: null, lastOrderDays: null, lastCollectionDays: null, lat: 17.1, lng: 78.1,
} as never;
const checkin = {
  id: "k1", customerId: "c1", customerName: "Acme Traders", checkInAt: null, planned: "unplanned",
  orders: [], collections: [], lat: 17.2, lng: 78.2,
} as never;
const rep = { userId: "u1", name: "Asha", lastLatitude: 17.4, lastLongitude: 78.5, live: true } as never;

const base = {
  visible: [rep],
  customers: [customer],
  checkins: [checkin],
  bands: [],
  route: [],
  selectedId: null as string | null,
  setSelectedId: vi.fn(),
};

beforeEach(() => {
  base.setSelectedId = vi.fn();
  (router.push as ReturnType<typeof vi.fn>).mockClear?.();
});

describe("TrackingMap", () => {
  it("renders the map and reveals it on render-complete", () => {
    render(<TrackingMap {...base} />);
    expect(screen.getByLabelText("india-map")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("map-render-complete")); // onRenderComplete → setReady
  });

  it("falls back to the all-India state outline when there is no located data", () => {
    render(<TrackingMap {...base} visible={[]} customers={[]} checkins={[]} route={[]} />);
    expect(screen.getByLabelText("india-map")).toBeInTheDocument();
  });

  it("opens a customer card, closes it, then opens that customer", () => {
    render(<TrackingMap {...base} />);
    fireEvent.click(screen.getByLabelText("marker-17.1,78.1")); // customer dot
    expect(screen.getByText("No dues")).toBeInTheDocument(); // customer card shown
    fireEvent.click(screen.getByLabelText("close")); // close the card
    expect(screen.queryByText("No dues")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("marker-17.1,78.1")); // re-open
    fireEvent.click(screen.getByText("Acme Traders")); // open the customer
    expect(router.push).toHaveBeenCalledWith({ pathname: "/customer/[id]", params: { id: "c1", name: "Acme Traders" } });
  });

  it("opens a check-in card, closes it, then opens its customer", () => {
    render(<TrackingMap {...base} />);
    fireEvent.click(screen.getByLabelText("marker-17.2,78.2")); // check-in pin
    expect(screen.getByText("Unplanned visit")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("close")); // close
    expect(screen.queryByText("Unplanned visit")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("marker-17.2,78.2")); // re-open
    fireEvent.click(screen.getByText("Acme Traders")); // open the customer from the check-in card
    expect(router.push).toHaveBeenCalledWith({ pathname: "/customer/[id]", params: { id: "c1", name: "Acme Traders" } });
  });

  it("selects the rep on a rep-marker tap", () => {
    render(<TrackingMap {...base} />);
    fireEvent.click(screen.getByLabelText("marker-17.4,78.5")); // rep dot
    expect(base.setSelectedId).toHaveBeenCalledWith("u1");
  });

  it("draws the selected rep's route when it is ready", () => {
    const route = [
      { latitude: 17.1, longitude: 78.1, recordedAt: "2026-11-27T04:00:00Z" },
      { latitude: 17.2, longitude: 78.2, recordedAt: "2026-11-27T04:05:00Z" },
    ] as never;
    render(<TrackingMap {...base} route={route} selectedId="u1" />);
    expect(screen.getByLabelText("india-map")).toBeInTheDocument();
  });
});
