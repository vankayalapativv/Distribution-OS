import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn(async (..._a: unknown[]) => ({ openingBalance: null }));
vi.mock("@/lib/api-client", () => ({ apiGet: (...a: unknown[]) => apiGet(...a) }));
vi.mock("./opening-balance-form", () => ({
  OpeningForm: (p: { onDone: () => void; onCancel: () => void }) => (
    <div>
      <button onClick={() => p.onDone()}>done</button>
      <button onClick={() => p.onCancel()}>cancel</button>
    </div>
  ),
}));

import { OpeningBalanceDialog } from "./opening-balance-dialog";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const wrap = (qc: QueryClient) => ({ children }: { readonly children: ReactNode }) =>
  createElement(QueryClientProvider, { client: qc }, children);

const renderDialog = (onChanged?: () => void, loading = false) => {
  if (loading) apiGet.mockImplementation(() => new Promise(() => {}));
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(qc, "invalidateQueries");
  const onOpenChange = vi.fn();
  render(
    <OpeningBalanceDialog open onOpenChange={onOpenChange} customerId="c1" role="SUPER_ADMIN" actionConfig={cfg} onChanged={onChanged} />,
    { wrapper: wrap(qc) },
  );
  return { invalidate, onOpenChange };
};

afterEach(() => apiGet.mockReset());

describe("OpeningBalanceDialog", () => {
  it("shows a loading state until the balance query resolves", () => {
    renderDialog(undefined, true);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders the form and, on done, invalidates + fires onChanged + closes", async () => {
    apiGet.mockResolvedValue({ openingBalance: null });
    const onChanged = vi.fn();
    const { invalidate, onOpenChange } = renderDialog(onChanged);
    await waitFor(() => expect(screen.getByRole("button", { name: "done" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "done" }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["opening-balance", "c1"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["customer-ledger", "c1"] });
    expect(onChanged).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("cancel closes without erroring when onChanged is omitted", async () => {
    apiGet.mockResolvedValue({ openingBalance: null });
    const { onOpenChange } = renderDialog();
    await waitFor(() => expect(screen.getByRole("button", { name: "cancel" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
