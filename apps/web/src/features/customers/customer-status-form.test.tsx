import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiRequest = vi.fn();
vi.mock("@/lib/api-client", () => ({
  apiRequest: (...a: unknown[]) => apiRequest(...a),
  errorMessage: (_e: unknown, fallback: string) => fallback,
}));

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { StatusForm } from "./customer-status-form";
import type { Customer } from "./customers-api";
import type { ComponentProps } from "react";

const customer = { id: "c1", status: "active" } as unknown as Customer;
const cfg = { apiBaseUrl: "x", authToken: "t" };

const renderForm = (props: ComponentProps<typeof StatusForm>) =>
  render(
    <Dialog open onOpenChange={() => {}}>
      <DialogContent size="sm">
        <StatusForm {...props} />
      </DialogContent>
    </Dialog>,
  );

afterEach(() => apiRequest.mockReset());

describe("StatusForm", () => {
  it("submits the chosen status and reports the updated customer", async () => {
    const updated = { id: "c1", status: "inactive" } as unknown as Customer;
    apiRequest.mockResolvedValue(updated);
    const onDone = vi.fn();
    renderForm({ customer, actionConfig: cfg, onDone, onCancel: vi.fn() });

    fireEvent.submit(screen.getByRole("button", { name: "Update status" }).closest("form")!);
    expect(screen.getByRole("button", { name: "Saving…" })).toBeInTheDocument();
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(updated));
    expect(apiRequest).toHaveBeenCalledWith(cfg, "PATCH", "/customers/c1/status", { status: "active" });
  });

  it("shows an error message when the update fails", async () => {
    apiRequest.mockRejectedValue(new Error("boom"));
    renderForm({ customer, actionConfig: cfg, onDone: vi.fn(), onCancel: vi.fn() });
    fireEvent.submit(screen.getByRole("button", { name: "Update status" }).closest("form")!);
    await waitFor(() => expect(screen.getByText("Failed to update status.")).toBeInTheDocument());
  });

  it("calls onCancel from the Cancel button", () => {
    const onCancel = vi.fn();
    renderForm({ customer, actionConfig: cfg, onDone: vi.fn(), onCancel });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
