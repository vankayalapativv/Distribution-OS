import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ActiveRunView } from "./active-run-view";

const base = {
  vehicleNumber: "KA01",
  stops: [],
  refreshing: false,
  onRefresh: () => {},
  onAdd: vi.fn(),
  onEndPress: vi.fn(),
};

describe("ActiveRunView", () => {
  it("shows the empty state and wires Add / End", () => {
    const onAdd = vi.fn();
    const onEndPress = vi.fn();
    render(<ActiveRunView {...base} onAdd={onAdd} onEndPress={onEndPress} />);
    expect(screen.getByText(/Vehicle KA01 · 0 done/)).toBeInTheDocument();
    expect(screen.getByText(/No deliveries yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("+ Add delivery"));
    expect(onAdd).toHaveBeenCalled();
    fireEvent.click(screen.getByText("End"));
    expect(onEndPress).toHaveBeenCalled();
  });

  it("lists delivered stops with a photo count (singular/plural + name fallback)", () => {
    render(
      <ActiveRunView
        {...base}
        stops={[
          { clientUuid: "s1", customerName: "Acme", photoCount: 1 } as never,
          { clientUuid: "s2", customerName: null, photoCount: 3 } as never,
        ]}
      />,
    );
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("Customer")).toBeInTheDocument(); // null name fallback
    expect(screen.getByText("1 photo")).toBeInTheDocument();
    expect(screen.getByText("3 photos")).toBeInTheDocument();
  });
});
