import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Linking } from "react-native";
import { HeroCard } from "./hero-card";

const header = (over: Record<string, unknown> = {}) =>
  ({ addressStreet: "1 Main St", addressCity: "Hyd", phone: "9876543210", ...over }) as never;

describe("HeroCard", () => {
  it("shows address, phone (dials), and a red positive balance", () => {
    const spy = vi.spyOn(Linking, "openURL").mockResolvedValue(undefined as never);
    render(<HeroCard header={header()} credit={{ totalOutstanding: 1500 } as never} creditPending={false} />);
    expect(screen.getByText("1 Main St, Hyd")).toBeInTheDocument();
    fireEvent.click(screen.getByText("9876543210"));
    expect(spy).toHaveBeenCalledWith("tel:9876543210");
    expect(screen.getByText("₹1,500")).toBeInTheDocument();
    spy.mockRestore();
  });

  it("shows a green negative (paid-ahead) balance", () => {
    render(<HeroCard header={header({ addressStreet: null, addressCity: null, phone: null })} credit={{ totalOutstanding: -200 } as never} creditPending={false} />);
    expect(screen.getByText("₹200")).toBeInTheDocument();
  });

  it("shows a neutral zero balance and a skeleton while pending", () => {
    const { rerender } = render(<HeroCard header={header()} credit={null} creditPending={true} />);
    expect(screen.queryByText("₹0")).not.toBeInTheDocument(); // pending → skeleton, no value
    rerender(<HeroCard header={header()} credit={{ totalOutstanding: 0 } as never} creditPending={false} />);
    expect(screen.getByText("₹0")).toBeInTheDocument();
  });

  it("renders the credit-block banner when blocked", () => {
    render(
      <HeroCard
        header={header()}
        credit={{ totalOutstanding: 500, creditBlocked: true, creditOverdueDays: 30 } as never}
        creditPending={false}
      />,
    );
    expect(screen.getByText(/30-day credit period/)).toBeInTheDocument();
    expect(screen.getByText(/New orders are blocked/)).toBeInTheDocument();
  });

  it("defaults the overdue days to 0 when blocked without a period", () => {
    render(
      <HeroCard header={header()} credit={{ totalOutstanding: 500, creditBlocked: true } as never} creditPending={false} />,
    );
    expect(screen.getByText(/0-day credit period/)).toBeInTheDocument();
  });
});
