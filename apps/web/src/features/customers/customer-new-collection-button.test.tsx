import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn();
vi.mock("@/lib/api-client", () => ({ apiGet: (...a: unknown[]) => apiGet(...a) }));
// Cross-feature dialog — stubbed (belongs to the Collections page).
vi.mock("@/features/collections/collections-create-dialog", () => ({
  CollectionsCreateDialog: (p: { open: boolean; onCreated: () => void }) =>
    p.open ? <button onClick={() => p.onCreated()}>created</button> : null,
}));

import { CustomerNewCollectionButton } from "./customer-new-collection-button";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const wrapper = (qc: QueryClient) => ({ children }: { readonly children: ReactNode }) =>
  createElement(QueryClientProvider, { client: qc }, children);

afterEach(() => apiGet.mockReset());

function setup(onCreated?: () => void) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(qc, "invalidateQueries");
  render(
    <CustomerNewCollectionButton customerId="c1" customerName="Ravi Motors" actionConfig={cfg} onCreated={onCreated} />,
    { wrapper: wrapper(qc) },
  );
  return { invalidate };
}

describe("CustomerNewCollectionButton", () => {
  it("lazy-loads collectors on first open, showing a loading label, then the dialog", async () => {
    let resolve!: (v: unknown) => void;
    apiGet.mockImplementation(() => new Promise((r) => (resolve = r)));
    setup();
    fireEvent.click(screen.getByRole("button", { name: "+ New Collection" }));
    expect(screen.getByRole("button", { name: "Loading…" })).toBeInTheDocument();
    resolve([{ id: "u1", name: "Ravi" }]);
    await waitFor(() => expect(screen.getByRole("button", { name: "created" })).toBeInTheDocument());
  });

  it("invalidates the ledger and calls onCreated on success", async () => {
    apiGet.mockResolvedValue([{ id: "u1", name: "Ravi" }]);
    const onCreated = vi.fn();
    const { invalidate } = setup(onCreated);
    fireEvent.click(screen.getByRole("button", { name: "+ New Collection" }));
    await waitFor(() => screen.getByRole("button", { name: "created" }));
    fireEvent.click(screen.getByRole("button", { name: "created" }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["customer-ledger", "c1"] });
    expect(onCreated).toHaveBeenCalled();
  });

  it("works without an onCreated callback", async () => {
    apiGet.mockResolvedValue([{ id: "u1", name: "Ravi" }]);
    setup(); // no onCreated
    fireEvent.click(screen.getByRole("button", { name: "+ New Collection" }));
    await waitFor(() => screen.getByRole("button", { name: "created" }));
    expect(() => fireEvent.click(screen.getByRole("button", { name: "created" }))).not.toThrow();
  });
});
