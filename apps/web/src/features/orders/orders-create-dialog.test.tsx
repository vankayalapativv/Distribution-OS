import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */
let draftReturn: any;
vi.mock("./use-order-draft", () => ({ useOrderDraft: () => draftReturn }));
vi.mock("./order-header-fields", () => ({ OrderHeaderFields: () => <div data-testid="header" /> }));
vi.mock("./order-locked-lines-editor", () => ({ OrderLockedLinesEditor: () => <div data-testid="locked" /> }));
vi.mock("./order-line-items-tabs", () => ({ OrderLineItemsTabs: () => <div data-testid="tabs" /> }));
/* eslint-enable @typescript-eslint/no-explicit-any */

import { OrdersCreateDialog } from "./orders-create-dialog";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const props = {
  open: true,
  onOpenChange: vi.fn(),
  products: [],

  customers: [],
  salesExecutives: [],
  actionConfig: cfg,
};

const closeCreate = vi.fn();
const handleCreate = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
const makeDraft = (over: Record<string, unknown> = {}) => ({
  isEdit: false,
  isPartial: false,
  lockedLines: [],
  setLockedQty: vi.fn(),
  isCreating: false,
  createError: null,
  selectedCustomerId: "c1",
  closeCreate,
  handleCreate,
  ...over,
});

afterEach(() => {
  closeCreate.mockReset();
  handleCreate.mockClear();
  vi.clearAllMocks();
});

describe("OrdersCreateDialog", () => {
  it("titles by mode and always shows header + tabs", () => {
    draftReturn = makeDraft();
    const { rerender } = render(<OrdersCreateDialog {...props} />);
    expect(screen.getByText("New order")).toBeInTheDocument();
    expect(screen.getByTestId("header")).toBeInTheDocument();
    expect(screen.getByTestId("tabs")).toBeInTheDocument();
    draftReturn = makeDraft({ isEdit: true });
    rerender(<OrdersCreateDialog {...props} />);
    expect(screen.getByText("Edit order")).toBeInTheDocument();
  });

  it("shows the locked-lines editor only when the order is partial", () => {
    draftReturn = makeDraft({ isPartial: true });
    const { rerender } = render(<OrdersCreateDialog {...props} />);
    expect(screen.getByTestId("locked")).toBeInTheDocument();
    draftReturn = makeDraft({ isPartial: false });
    rerender(<OrdersCreateDialog {...props} />);
    expect(screen.queryByTestId("locked")).not.toBeInTheDocument();
  });

  it("surfaces a create error", () => {
    draftReturn = makeDraft({ createError: "Bad order" });
    render(<OrdersCreateDialog {...props} />);
    expect(screen.getByText("Bad order")).toBeInTheDocument();
  });

  it("labels the submit button for each state", () => {
    for (const [state, label] of [
      [{}, "Create order"],
      [{ isEdit: true }, "Save changes"],
      [{ isCreating: true }, "Creating…"],
      [{ isCreating: true, isEdit: true }, "Saving…"],
    ] as const) {
      draftReturn = makeDraft(state);
      const { unmount } = render(<OrdersCreateDialog {...props} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });

  it("disables submit without a customer", () => {
    draftReturn = makeDraft({ selectedCustomerId: "" });
    render(<OrdersCreateDialog {...props} />);
    expect(screen.getByRole("button", { name: "Create order" })).toBeDisabled();
  });

  it("cancel closes and submit calls handleCreate", () => {
    draftReturn = makeDraft();
    render(<OrdersCreateDialog {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(closeCreate).toHaveBeenCalled();
    fireEvent.submit(screen.getByRole("button", { name: "Create order" }).closest("form")!);
    expect(handleCreate).toHaveBeenCalled();
  });
});
