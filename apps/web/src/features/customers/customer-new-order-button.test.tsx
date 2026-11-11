import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn(async (...args: unknown[]) => {
  const url = args[1] as string;
  if (url.includes("products")) return { products: [] };
  return { salesExecutives: [] };
});
vi.mock("@/lib/api-client", () => ({ apiGet: (...a: unknown[]) => apiGet(...a) }));
vi.mock("@/features/orders/orders-create-dialog", () => ({
  OrdersCreateDialog: (p: { open: boolean; onCreated: () => void }) =>
    p.open ? <button onClick={() => p.onCreated()}>created</button> : null,
}));

import { CustomerNewOrderButton } from "./customer-new-order-button";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const wrapper = (qc: QueryClient) => ({ children }: { readonly children: ReactNode }) =>
  createElement(QueryClientProvider, { client: qc }, children);

afterEach(() => apiGet.mockClear());

describe("CustomerNewOrderButton", () => {
  it("lazy-loads the catalogue then opens the dialog; onCreated refetches orders", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    render(<CustomerNewOrderButton customerId="c1" customerName="Ravi Motors" actionConfig={cfg} />, { wrapper: wrapper(qc) });

    fireEvent.click(screen.getByRole("button", { name: "+ New Order" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "created" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "created" }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["customer-orders", "c1"] });
  });

  it("shows a loading label while the catalogue is still fetching", async () => {
    apiGet.mockImplementation(() => new Promise(() => {})); // never resolves
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<CustomerNewOrderButton customerId="c1" customerName="Ravi" actionConfig={cfg} variant="outline" />, { wrapper: wrapper(qc) });
    fireEvent.click(screen.getByRole("button", { name: "+ New Order" }));
    expect(screen.getByRole("button", { name: "Loading…" })).toBeInTheDocument();
  });
});
