import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { router } from "expo-router";

let params: Record<string, unknown> = { id: "c1", name: "Acme" };
const useQuery = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  // Invoke queryFn so its apiFetch arrow is covered, then return the stubbed state.
  useQuery: (cfg: { queryFn: () => unknown }) => { cfg.queryFn(); return useQuery(); },
}));
vi.mock("expo-router", () => ({ router: { back: vi.fn(), push: vi.fn() }, useLocalSearchParams: () => params }));
vi.mock("../../lib/auth", () => ({ useAuth: (sel: (s: unknown) => unknown) => sel({ token: "t" }) }));
vi.mock("../../lib/api", () => ({ apiFetch: vi.fn() }));
vi.mock("../../components/error-state", () => ({ ErrorState: ({ onRetry }: { onRetry: () => void }) => <button type="button" onClick={onRetry}>retry</button> }));
vi.mock("../../components/customer/edit/edit-customer-form", () => ({ EditForm: ({ id }: { id: string }) => <span>edit-form-{id}</span> }));

import EditCustomerScreen from "./edit";

describe("EditCustomerScreen", () => {
  it("shows the skeleton while loading (title falls back to the param name)", () => {
    useQuery.mockReturnValue({ isPending: true, isError: false, data: undefined, refetch: vi.fn() });
    render(<EditCustomerScreen />);
    expect(screen.getByText("Edit Acme")).toBeInTheDocument();
    expect(screen.queryByText(/edit-form/)).not.toBeInTheDocument();
  });

  it("shows a retryable error and the generic title with no name/data", () => {
    params = { id: "c1" }; // no name → title falls back to "customer"
    const refetch = vi.fn();
    useQuery.mockReturnValue({ isPending: false, isError: true, error: new Error("x"), data: undefined, refetch });
    render(<EditCustomerScreen />);
    expect(screen.getByText("Edit customer")).toBeInTheDocument();
    fireEvent.click(screen.getByText("retry"));
    expect(refetch).toHaveBeenCalled();
    params = { id: "c1", name: "Acme" }; // restore
  });

  it("renders the form with the loaded customer and navigates back", () => {
    (router.back as ReturnType<typeof vi.fn>).mockClear();
    useQuery.mockReturnValue({ isPending: false, isError: false, data: { legalName: "Acme Oils" }, refetch: vi.fn() });
    render(<EditCustomerScreen />);
    expect(screen.getByText("Edit Acme Oils")).toBeInTheDocument();
    expect(screen.getByText("edit-form-c1")).toBeInTheDocument();
    fireEvent.click(screen.getByText("‹"));
    expect(router.back).toHaveBeenCalled();
  });
});
