import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */
const apiGet = vi.fn().mockResolvedValue({ brands: ["Fuchs", "Savsol"] });
vi.mock("@/lib/api-client", () => ({ apiGet: (...a: unknown[]) => apiGet(...a) }));

let last: any = null;
vi.mock("@/features/orders/order-search-combobox", () => ({
  OrderSearchCombobox: (p: any) => {
    last = p;
    return (
      <div>
        <button data-testid="trigger" onClick={() => p.onOpenChange(!p.open)}>{p.triggerLabel}</button>
        <input aria-label="search" value={p.searchValue} ref={(el) => p.registerSearchInput?.(el)}
          onChange={(e) => p.onSearchChange(e.target.value)} />
        {p.items.map((it: any) => (
          <button key={p.getKey(it)} data-sel={String(p.isSelected(it))} onClick={() => p.onSelect(it)}>{p.renderItem(it)}</button>
        ))}
      </div>
    );
  },
}));
/* eslint-enable @typescript-eslint/no-explicit-any */

import { BrandField } from "./brand-field";

const cfg = { apiBaseUrl: "", authToken: "" };
function renderField(value = "", onChange = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <BrandField category="oils" value={value} onChange={onChange} actionConfig={cfg} />
    </QueryClientProvider>,
  );
  return onChange;
}
const loaded = () => waitFor(() => expect(last.items.length).toBeGreaterThan(0));

describe("BrandField", () => {
  it("fetches + lists the brands and marks the selected one", async () => {
    renderField("Fuchs");
    await loaded();
    expect(apiGet).toHaveBeenCalledWith(cfg, "/brands?category=oils");
    expect(last.items).toEqual([{ kind: "brand", value: "Fuchs" }, { kind: "brand", value: "Savsol" }]);
    expect(last.isSelected({ kind: "brand", value: "Fuchs" })).toBe(true);
    expect(last.isSelected({ kind: "create", value: "Fuchs" })).toBe(false);
  });

  it("offers a create row for a new typed brand (renders 'Use …'), filters existing, and toggles open", async () => {
    renderField();
    await loaded();
    fireEvent.change(screen.getByLabelText("search"), { target: { value: "Shell" } });
    expect(last.items[0]).toMatchObject({ kind: "create", value: "Shell" });
    expect(screen.getByText(/Use/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("search"), { target: { value: "fuchs" } });
    expect(last.items).toEqual([{ kind: "brand", value: "Fuchs" }]);
    // open then close clears the search
    fireEvent.click(screen.getByTestId("trigger"));
    fireEvent.click(screen.getByTestId("trigger"));
    expect(last.searchValue).toBe("");
  });

  it("selecting a row calls onChange with its value", async () => {
    const onChange = renderField();
    await loaded();
    fireEvent.click(screen.getByText("Savsol"));
    expect(onChange).toHaveBeenCalledWith("Savsol");
  });
});
