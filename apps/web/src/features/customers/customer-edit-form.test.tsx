import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiRequest = vi.fn(async (..._a: unknown[]) => ({ id: "c1", updated: true }));
vi.mock("@/lib/api-client", () => ({
  apiRequest: (...a: unknown[]) => apiRequest(...a),
  errorMessage: (_e: unknown, f: string) => f,
}));
vi.mock("./customer-edit-form-fields", () => ({
  CustomerEditFormFields: () => <input name="legalName" defaultValue="Raj Motors" aria-label="legal" />,
}));
vi.mock("./customer-edit-fields", () => ({ splitSegments: (s: string | null) => (s ? s.split(",") : []) }));

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EditForm } from "./customer-edit-form";
import type { Customer } from "./customers-api";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const customer = { id: "c1", customerType: "retail", segment: "Car" } as unknown as Customer;

const renderForm = (onDone = vi.fn(), onCancel = vi.fn()) =>
  render(
    <Dialog open onOpenChange={() => {}}>
      <DialogContent size="lg">
        <EditForm customer={customer} actionConfig={cfg} onDone={onDone} onCancel={onCancel} />
      </DialogContent>
    </Dialog>,
  );

afterEach(() => apiRequest.mockReset());

describe("EditForm", () => {
  it("PATCHes the customer and reports the update", async () => {
    apiRequest.mockResolvedValueOnce({ id: "c1", updated: true });
    const onDone = vi.fn();
    renderForm(onDone);
    fireEvent.submit(screen.getByRole("button", { name: "Save changes" }).closest("form")!);
    expect(screen.getByRole("button", { name: "Saving…" })).toBeInTheDocument();
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        cfg,
        "PATCH",
        "/customers/c1",
        expect.objectContaining({ customerType: "retail", segment: "Car" }),
      ),
    );
    expect(onDone).toHaveBeenCalledWith({ id: "c1", updated: true });
  });

  it("shows an error when the update fails", async () => {
    apiRequest.mockRejectedValueOnce(new Error("no"));
    renderForm();
    fireEvent.submit(screen.getByRole("button", { name: "Save changes" }).closest("form")!);
    await waitFor(() => expect(screen.getByText("Failed to update customer.")).toBeInTheDocument());
  });

  it("cancels via the Cancel button", () => {
    const onCancel = vi.fn();
    renderForm(vi.fn(), onCancel);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
