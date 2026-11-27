import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { router } from "expo-router";

let params: Record<string, unknown> = { customerId: "c1", customerName: "Acme" };
vi.mock("expo-router", () => ({ router: { back: vi.fn() }, useLocalSearchParams: () => params }));
const useOrderCart = vi.fn();
const useOrderQueries = vi.fn();
const useOrderSubmit = vi.fn();
vi.mock("../../lib/order/use-order-cart", () => ({ useOrderCart: () => useOrderCart() }));
vi.mock("../../lib/order/use-order-queries", () => ({ useOrderQueries: (...a: unknown[]) => useOrderQueries(...a) }));
vi.mock("../../lib/order/use-order-submit", () => ({ useOrderSubmit: (...a: unknown[]) => useOrderSubmit(...a) }));
vi.mock("../../lib/auth", () => ({ useAuth: (sel: (s: unknown) => unknown) => sel({ token: "t" }) }));
vi.mock("../../components/order/catalogue-load-error", () => ({
  CatalogueLoading: ({ onBack }: { onBack: () => void }) => <button type="button" onClick={onBack}>loading</button>,
  CatalogueLoadError: ({ onRetry, onBack }: { onRetry: () => void; onBack: () => void }) => <div><button type="button" onClick={onRetry}>retry</button><button type="button" onClick={onBack}>err-back</button></div>,
}));
vi.mock("../../components/order/catalogue-screen", () => ({ CatalogueScreen: ({ onReview, offline, creditUnknown }: { onReview: () => void; offline: boolean; creditUnknown: boolean }) => <button type="button" onClick={onReview}>catalogue-{String(offline)}-{String(creditUnknown)}</button> }));
vi.mock("../../components/order/review-screen", () => ({ ReviewScreen: ({ onBack, onSubmit }: { onBack: () => void; onSubmit: () => void }) => <div><button type="button" onClick={onBack}>review-back</button><button type="button" onClick={onSubmit}>review-submit</button></div> }));
vi.mock("../../components/order/result-screens", () => ({
  OrderConfirmation: ({ onDone, onAnother }: { onDone: () => void; onAnother: () => void }) => <div><button type="button" onClick={onDone}>done</button><button type="button" onClick={onAnother}>another</button></div>,
  CreditBlocked: ({ onBack }: { onBack: () => void }) => <button type="button" onClick={onBack}>blocked-back</button>,
}));

import NewOrderScreen from "./new";

function setup(over: { oils?: Record<string, unknown>; credit?: Record<string, unknown>; submit?: Record<string, unknown> } = {}) {
  const cart = { reset: vi.fn() };
  useOrderCart.mockReturnValue(cart);
  useOrderQueries.mockReturnValue({
    oils: { data: [{ id: "p1" }], isPending: false, isError: false, error: null, fromCache: false, isFetching: false, refetch: vi.fn(), ...over.oils },
    credit: { data: { creditBlocked: false }, isPending: false, ...over.credit },
  });
  useOrderSubmit.mockReturnValue({ result: null, submit: vi.fn(), submitting: false, error: null, reset: vi.fn(), ...over.submit });
  return { cart };
}

describe("NewOrderScreen", () => {
  it("shows the catalogue, enters review, submits and goes back", () => {
    setup();
    render(<NewOrderScreen />);
    fireEvent.click(screen.getByText(/catalogue-false-false/));
    fireEvent.click(screen.getByText("review-submit"));
    fireEvent.click(screen.getByText("review-back")); // leave review
  });

  it("shows the confirmation (done + another reset the flow)", () => {
    const s = setup({ submit: { result: { orderCode: "ORD-1", queued: false } } });
    render(<NewOrderScreen />);
    fireEvent.click(screen.getByText("another"));
    expect(s.cart.reset).toHaveBeenCalled();
    fireEvent.click(screen.getByText("done"));
  });

  it("blocks ordering when credit is blocked", () => {
    setup({ credit: { data: { creditBlocked: true } } });
    render(<NewOrderScreen />);
    fireEvent.click(screen.getByText("blocked-back"));
  });

  it("shows loading then error with retry", () => {
    setup({ oils: { isPending: true } });
    const { unmount } = render(<NewOrderScreen />);
    fireEvent.click(screen.getByText("loading")); // onBack
    unmount();
    const refetch = vi.fn();
    setup({ oils: { data: undefined, isError: true, error: new Error("x"), refetch } });
    render(<NewOrderScreen />);
    fireEvent.click(screen.getByText("retry"));
    expect(refetch).toHaveBeenCalled();
    fireEvent.click(screen.getByText("err-back")); // onBack
  });

  it("flags offline + unknown credit on the catalogue", () => {
    setup({ oils: { fromCache: true, isFetching: false }, credit: { data: null } });
    render(<NewOrderScreen />);
    expect(screen.getByText("catalogue-true-true")).toBeInTheDocument();
  });
});
