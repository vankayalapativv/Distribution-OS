import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Linking } from "react-native";
import { router as expoRouter } from "expo-router";
import { StopRow } from "./stop-row";
import type { BeatStop } from "../../lib/beat/today-beat-online";

const L = Linking as unknown as { openURL?: unknown };

const stop = (over: Partial<BeatStop> = {}): BeatStop => ({
  stopId: "s1",
  sequenceNo: 3,
  stopStatus: "completed",
  customerId: "c1",
  customerCode: "C1",
  legalName: "Sri Traders",
  contactPhone: "+919876543210",
  address: null,
  city: "Hyderabad",
  outstanding: 0,
  dueBucket: null,
  lastOrderDate: null,
  lastCollectionDate: null,
  ...over,
});

const todayISO = new Date().toISOString().slice(0, 10);

afterEach(() => {
  delete L.openURL;
  vi.restoreAllMocks();
});

describe("StopRow", () => {
  it("renders the sequence, name, city, phone, and done pill; opens the customer on tap", () => {
    (expoRouter.push as ReturnType<typeof vi.fn>).mockClear?.();
    render(<StopRow stop={stop()} />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Sri Traders")).toBeInTheDocument();
    expect(screen.getByText("Hyderabad")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Sri Traders"));
    expect(expoRouter.push).toHaveBeenCalledWith({
      pathname: "/customer/[id]",
      params: { id: "c1", name: "Sri Traders" },
    });
  });

  it("dials the phone number when tapped", () => {
    const openURL = vi.fn(() => Promise.resolve());
    L.openURL = openURL;
    render(<StopRow stop={stop()} />);
    fireEvent.click(screen.getByText("+919876543210"));
    expect(openURL).toHaveBeenCalledWith("tel:+919876543210");
  });

  it("shows a due badge with bucket meta when outstanding", () => {
    render(<StopRow stop={stop({ outstanding: 5000, dueBucket: "60_plus" })} />);
    expect(screen.getByText(/Due ₹5,000/)).toBeInTheDocument();
    expect(screen.getByText(/61\+d/)).toBeInTheDocument();
  });

  it("shows red 'No orders/collections yet' chips when the customer has neither", () => {
    render(<StopRow stop={stop()} />);
    expect(screen.getByText("No orders yet")).toBeInTheDocument();
    expect(screen.getByText("No collections yet")).toBeInTheDocument();
  });

  it("shows last-order and last-collection recency chips when present", () => {
    render(<StopRow stop={stop({ lastOrderDate: todayISO, lastCollectionDate: todayISO })} />);
    expect(screen.getByText("Last order today")).toBeInTheDocument();
    expect(screen.getByText("Last collection today")).toBeInTheDocument();
  });

  const undef = undefined as unknown as null;

  it("hides both recency chips when the beat payload omits them (stale cache)", () => {
    render(<StopRow stop={stop({ lastOrderDate: undef, lastCollectionDate: undef })} />);
    expect(screen.queryByText(/No orders yet/)).not.toBeInTheDocument();
    expect(screen.queryByText(/No collections yet/)).not.toBeInTheDocument();
  });

  it("hides only the order chip when just that field is absent", () => {
    render(<StopRow stop={stop({ lastOrderDate: undef, lastCollectionDate: null })} />);
    expect(screen.queryByText(/No orders yet/)).not.toBeInTheDocument();
    expect(screen.getByText("No collections yet")).toBeInTheDocument();
  });

  it("hides only the collection chip when just that field is absent", () => {
    render(<StopRow stop={stop({ lastOrderDate: null, lastCollectionDate: undef })} />);
    expect(screen.getByText("No orders yet")).toBeInTheDocument();
    expect(screen.queryByText(/No collections yet/)).not.toBeInTheDocument();
  });

  it("falls back for a missing city / name / due-bucket meta", () => {
    (expoRouter.push as ReturnType<typeof vi.fn>).mockClear?.();
    render(
      <StopRow
        stop={stop({ city: null, contactPhone: null, legalName: null as unknown as string, outstanding: 7000, dueBucket: null })}
      />,
    );
    expect(screen.getByText("Customer")).toBeInTheDocument(); // empty legalName fallback
    expect(screen.queryByText("Hyderabad")).not.toBeInTheDocument();
    expect(screen.getByText(/Due ₹7,000/)).toBeInTheDocument(); // badge without bucket meta
    fireEvent.click(screen.getByText("Customer"));
    expect(expoRouter.push).toHaveBeenCalledWith({
      pathname: "/customer/[id]",
      params: { id: "c1", name: "" }, // null legalName → "" via ?? ""
    });
  });
});
