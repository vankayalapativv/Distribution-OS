import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiRequest = vi.fn();
vi.mock("@/lib/api-client", () => ({
  apiRequest: (...a: unknown[]) => apiRequest(...a),
  errorMessage: (_e: unknown, fallback: string) => fallback,
}));

import { PermissionsView } from "./permissions-view";
import type { PermissionMatrix } from "./permissions-api";

const matrix: PermissionMatrix = {
  catalog: [
    { key: "section:customers", kind: "section", label: "Customers", group: "Sections", defaults: { MANAGER: true, ACCOUNTANT: true } },
    { key: "section:invoices", kind: "section", label: "Invoices", group: "Sections", defaults: { MANAGER: false, ACCOUNTANT: true } },
    { key: "action:orders.create", kind: "action", label: "Create orders", group: "Actions", defaults: { MANAGER: true, ACCOUNTANT: false } },
  ],
  roles: {
    MANAGER: { "section:customers": true, "section:invoices": false, "action:orders.create": true },
    ACCOUNTANT: { "section:customers": true, "section:invoices": true, "action:orders.create": false },
  },
};

const cfg = { apiBaseUrl: "x", authToken: "t" };
const renderView = () => render(<PermissionsView matrix={matrix} actionConfig={cfg} />);

afterEach(() => apiRequest.mockReset());

describe("PermissionsView", () => {
  it("renders a panel per role and the search box, with Save disabled", () => {
    renderView();
    expect(screen.getByText("Manager")).toBeInTheDocument();
    expect(screen.getByText("Accountant")).toBeInTheDocument();
    expect(screen.getByLabelText("Search capabilities")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("surfaces a pending count and a Discard action once something changes", () => {
    renderView();
    fireEvent.click(screen.getByRole("switch", { name: "Invoices for Manager" }));
    expect(screen.getByRole("button", { name: "Save 1 change" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Discard" })).toBeInTheDocument();
  });

  it("pluralises the pending count across several changes", () => {
    renderView();
    fireEvent.click(screen.getByRole("switch", { name: "Invoices for Manager" }));
    fireEvent.click(screen.getByRole("switch", { name: "Customers for Manager" }));
    expect(screen.getByRole("button", { name: "Save 2 changes" })).toBeEnabled();
  });

  it("saves only the changed role and then shows Saved", async () => {
    apiRequest.mockResolvedValue({});
    renderView();
    fireEvent.click(screen.getByRole("switch", { name: "Invoices for Manager" }));
    fireEvent.click(screen.getByRole("button", { name: "Save 1 change" }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1));
    expect(apiRequest).toHaveBeenCalledWith(cfg, "PUT", "/permissions/MANAGER", {
      entries: [{ key: "section:invoices", allowed: true }],
    });
    await screen.findByRole("button", { name: "Saved" });
  });

  it("discards reverts the pending change", () => {
    renderView();
    fireEvent.click(screen.getByRole("switch", { name: "Invoices for Manager" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();
  });

  it("applies a role preset via the panel's quick action", () => {
    renderView();
    // Accountant's 'Create orders' is off by default; Enable all flips it on.
    const accountantEnableAll = screen.getAllByRole("button", { name: "Enable all" })[1];
    fireEvent.click(accountantEnableAll);
    expect(screen.getByRole("button", { name: "Save 1 change" })).toBeEnabled();
  });

  it("filters both panels from the single search box", () => {
    renderView();
    fireEvent.change(screen.getByLabelText("Search capabilities"), { target: { value: "invoice" } });
    expect(screen.getAllByText("Invoices")).toHaveLength(2);
    expect(screen.queryByText("Customers")).not.toBeInTheDocument();
  });

  it("shows an error when the save fails", async () => {
    apiRequest.mockRejectedValue(new Error("nope"));
    renderView();
    fireEvent.click(screen.getByRole("switch", { name: "Invoices for Manager" }));
    fireEvent.click(screen.getByRole("button", { name: "Save 1 change" }));
    expect(await screen.findByText("Couldn't save permissions.")).toBeInTheDocument();
  });
});
