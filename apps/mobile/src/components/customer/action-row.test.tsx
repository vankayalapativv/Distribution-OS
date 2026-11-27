import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { router } from "expo-router";
import { ActionRow } from "./action-row";

const base = {
  id: "c1",
  customerName: "Acme",
  creditBlocked: false as boolean | undefined,
  creditLoading: false,
  isAdmin: false,
  onMarket: vi.fn(),
};

describe("ActionRow", () => {
  it("renders Order (unblocked) + Collect/Market/Ledger/Notes and routes each", () => {
    (router.push as ReturnType<typeof vi.fn>).mockClear();
    const onMarket = vi.fn();
    render(<ActionRow {...base} onMarket={onMarket} />);
    fireEvent.click(screen.getByText("Order"));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/order/new", params: { customerId: "c1", customerName: "Acme" } });
    fireEvent.click(screen.getByText("Collect"));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/collection/new", params: { customerId: "c1", customerName: "Acme" } });
    fireEvent.click(screen.getByText("Market"));
    expect(onMarket).toHaveBeenCalled();
    fireEvent.click(screen.getByText("Ledger"));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/ledger/[id]", params: { id: "c1", customerName: "Acme" } });
    fireEvent.click(screen.getByText("Notes"));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/notes/[id]", params: { id: "c1", customerName: "Acme" } });
  });

  it("shows Blocked (disabled) when credit is blocked", () => {
    (router.push as ReturnType<typeof vi.fn>).mockClear();
    render(<ActionRow {...base} creditBlocked={true} />);
    fireEvent.click(screen.getByText("Blocked"));
    expect(router.push).not.toHaveBeenCalledWith(expect.objectContaining({ pathname: "/order/new" }));
  });

  it("shows a skeleton for Order while credit resolves, and hides Market for admins", () => {
    render(<ActionRow {...base} creditBlocked={undefined} creditLoading={true} isAdmin />);
    expect(screen.queryByText("Order")).not.toBeInTheDocument(); // resolving → skeleton
    expect(screen.queryByText("Market")).not.toBeInTheDocument(); // admin → no Market
  });

  it("fails open to Order when credit couldn't be determined", () => {
    render(<ActionRow {...base} creditBlocked={undefined} creditLoading={false} />);
    expect(screen.getByText("Order")).toBeInTheDocument();
  });
});
