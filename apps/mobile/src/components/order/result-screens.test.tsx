import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CreditBlocked, OrderConfirmation } from "./result-screens";

const cart = (over: Record<string, unknown> = {}) => ({ totalLines: 2, totalLitres: 15, ...over }) as never;

describe("OrderConfirmation", () => {
  it("shows the placed state with the order code and finishes / restarts", () => {
    const onDone = vi.fn();
    const onAnother = vi.fn();
    render(<OrderConfirmation orderCode="ORD-1" customerName="Acme" cart={cart()} onDone={onDone} onAnother={onAnother} />);
    expect(screen.getByText("Order placed")).toBeInTheDocument();
    expect(screen.getByText(/ORD-1 · Acme/)).toBeInTheDocument();
    expect(screen.getByText(/2 items · 15 L/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Done"));
    expect(onDone).toHaveBeenCalled();
    fireEvent.click(screen.getByText("Start another order"));
    expect(onAnother).toHaveBeenCalled();
  });

  it("falls back to a generic customer in the placed state", () => {
    render(<OrderConfirmation orderCode="ORD-9" cart={cart()} onDone={() => {}} onAnother={() => {}} />);
    expect(screen.getByText(/ORD-9 · customer/)).toBeInTheDocument();
  });

  it("shows the offline-queued state with a singular count and a customer fallback", () => {
    const { rerender } = render(<OrderConfirmation orderCode="" queued cart={cart({ totalLines: 1 })} onDone={() => {}} onAnother={() => {}} />);
    expect(screen.getByText("Order saved")).toBeInTheDocument();
    expect(screen.getByText(/Will sync .* customer/)).toBeInTheDocument(); // fallback
    expect(screen.getByText(/1 item · 15 L/)).toBeInTheDocument();
    rerender(<OrderConfirmation orderCode="" queued customerName="Beta" cart={cart({ totalLines: 1 })} onDone={() => {}} onAnother={() => {}} />);
    expect(screen.getByText(/Will sync .* Beta/)).toBeInTheDocument();
  });
});

describe("CreditBlocked", () => {
  it("shows the block reason + outstanding and goes back", () => {
    const onBack = vi.fn();
    render(
      <CreditBlocked customerName="Acme" credit={{ creditOverdueDays: 45, totalOutstanding: 12000 } as never} onBack={onBack} />,
    );
    expect(screen.getByText("Orders blocked")).toBeInTheDocument();
    expect(screen.getByText(/45-day/)).toBeInTheDocument();
    expect(screen.getByText(/₹12,000/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Back"));
    expect(onBack).toHaveBeenCalled();
  });

  it("uses a generic subject when no customer name is given", () => {
    render(<CreditBlocked credit={{ creditOverdueDays: 30, totalOutstanding: 0 } as never} onBack={() => {}} />);
    expect(screen.getByText(/This customer/)).toBeInTheDocument();
  });
});
