import { describe, expect, it, vi } from "vitest";
import { Text } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react";
import { SegChip } from "./seg-chip";
import { OrderHeader } from "./order-header";
import { OrderBottomBar } from "./order-bottom-bar";
import { ReviewTotals } from "./review-totals";
import { CatalogueLoading, CatalogueLoadError } from "./catalogue-load-error";

const cart = (over: Record<string, unknown> = {}) =>
  ({ cartCount: 2, totalLines: 2, totalLitres: 15, ...over }) as never;

describe("SegChip", () => {
  it("renders active/inactive and fires onPress", () => {
    const onPress = vi.fn();
    const { rerender } = render(<SegChip label="Car" active onPress={onPress} />);
    fireEvent.click(screen.getByText("Car"));
    expect(onPress).toHaveBeenCalled();
    rerender(<SegChip label="Car" active={false} onPress={onPress} />); // inactive styling
    expect(screen.getByText("Car")).toBeInTheDocument();
  });
});

describe("OrderHeader", () => {
  it("renders title, a custom subtitle + right slot, and goes back", () => {
    const onBack = vi.fn();
    const { rerender } = render(
      <OrderHeader title="New order" subtitle="Acme" onBack={onBack} right={<Text>Cart · 2</Text>} />,
    );
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("Cart · 2")).toBeInTheDocument();
    fireEvent.click(screen.getByText("←"));
    expect(onBack).toHaveBeenCalled();
    rerender(<OrderHeader title="New order" onBack={onBack} />);
    expect(screen.getByText("Checking credit…")).toBeInTheDocument(); // subtitle fallback
  });
});

describe("OrderBottomBar", () => {
  it("shows the empty hint, then totals + Review", () => {
    const onReview = vi.fn();
    const { rerender } = render(<OrderBottomBar cart={cart({ cartCount: 0 })} onReview={onReview} />);
    expect(screen.getByText(/Tap an item/)).toBeInTheDocument();
    rerender(<OrderBottomBar cart={cart({ totalLines: 1 })} onReview={onReview} />);
    expect(screen.getByText(/1 item · 15 L/)).toBeInTheDocument(); // singular
    rerender(<OrderBottomBar cart={cart({ totalLines: 2 })} onReview={onReview} />);
    expect(screen.getByText(/2 items · 15 L/)).toBeInTheDocument(); // plural
    fireEvent.click(screen.getByText("Review"));
    expect(onReview).toHaveBeenCalled();
  });
});

describe("ReviewTotals", () => {
  it("renders the oils total (singular + plural)", () => {
    const { rerender } = render(<ReviewTotals cart={cart({ totalLines: 3 })} />);
    expect(screen.getByText(/3 items · 15 L/)).toBeInTheDocument();
    rerender(<ReviewTotals cart={cart({ totalLines: 1 })} />);
    expect(screen.getByText(/1 item · 15 L/)).toBeInTheDocument();
  });
});

describe("catalogue-load states", () => {
  it("CatalogueLoading shows the header + skeleton; CatalogueLoadError shows a retry", () => {
    const { rerender } = render(<CatalogueLoading customerName="Acme" onBack={() => {}} />);
    expect(screen.getByText("Acme")).toBeInTheDocument();
    const onRetry = vi.fn();
    rerender(<CatalogueLoadError customerName="Acme" onBack={() => {}} onRetry={onRetry} error={new Error("down")} />);
    fireEvent.click(screen.getByText("Try again"));
    expect(onRetry).toHaveBeenCalled();
  });
});
