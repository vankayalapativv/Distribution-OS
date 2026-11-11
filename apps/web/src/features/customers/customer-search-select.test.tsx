import { fireEvent, render as rtlRender, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const render = (ui: ReactElement) =>
  rtlRender(createElement(QueryClientProvider, { client: new QueryClient() }, ui));

// Capture the props the component hands to the combobox, and render enough of
// them (triggerLabel + each item via renderItem + emptyText) to exercise the
// component's own inline render props.
type ComboProps = {
  triggerLabel: ReactNode;
  onOpenChange: (o: boolean) => void;
  registerSearchInput: (el: HTMLInputElement | null) => void;
  onSearchChange: (v: string) => void;
  items: { id: string; legalName: string; addressCity?: string | null }[];
  getKey: (c: { id: string }) => string;
  isSelected: (c: { id: string }) => boolean;
  onSelect: (c: { id: string; legalName: string }) => void;
  renderItem: (c: { id: string; legalName: string; addressCity?: string | null }) => ReactNode;
  emptyText: string;
};
let last: ComboProps;
vi.mock("@/features/orders/order-search-combobox", () => ({
  OrderSearchCombobox: (p: ComboProps) => {
    last = p;
    return (
      <div>
        <div data-testid="trigger">{p.triggerLabel}</div>
        <div data-testid="empty">{p.emptyText}</div>
        {p.items.map((c) => (
          <button key={p.getKey(c)} data-sel={p.isSelected(c)} onClick={() => p.onSelect(c)}>
            {p.renderItem(c)}
          </button>
        ))}
      </div>
    );
  },
}));
vi.mock("@/lib/api-client", () => ({ apiGet: vi.fn() }));

import { CustomerSearchSelect } from "./customer-search-select";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const seed = [
  { id: "c1", legalName: "Seed Co", addressCity: "Hyd", salesExecutiveName: "Ravi" },
  { id: "c2", legalName: "Bare Co" },
];

describe("CustomerSearchSelect", () => {
  it("renders the placeholder, seeded items with meta, and selecting fires onSelect", () => {
    const onSelect = vi.fn();
    render(<CustomerSearchSelect actionConfig={cfg} valueKey="" onSelect={onSelect} seedItems={seed} />);

    expect(screen.getByTestId("trigger")).toHaveTextContent("Select customer");
    expect(screen.getByText("Seed Co")).toBeInTheDocument();
    expect(screen.getByText("Hyd · Ravi")).toBeInTheDocument(); // meta present
    expect(screen.queryByText("· ")).not.toBeInTheDocument(); // Bare Co has no meta line

    fireEvent.click(screen.getByText("Bare Co"));
    expect(onSelect).toHaveBeenCalledWith("c2");
  });

  it("marks the selected item and shows the chosen name in the trigger", () => {
    render(<CustomerSearchSelect actionConfig={cfg} valueKey="c1" onSelect={vi.fn()} seedItems={seed} />);
    expect(screen.getByTestId("trigger")).toHaveTextContent("Seed Co");
    expect(screen.getByRole("button", { name: "Seed CoHyd · Ravi" })).toHaveAttribute("data-sel", "true");
  });

  it("closing the combobox and registering the search input are wired through", async () => {
    render(<CustomerSearchSelect actionConfig={cfg} valueKey="" onSelect={vi.fn()} seedItems={seed} />);
    expect(screen.getByTestId("empty")).toHaveTextContent("No customers found");
    last.onOpenChange(true);
    last.onOpenChange(false);
    last.onSearchChange("x");

    const el = document.createElement("input");
    const focus = vi.spyOn(el, "focus");
    last.registerSearchInput(el);
    last.registerSearchInput(null); // null branch is a no-op
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(focus).toHaveBeenCalled();
  });
});
