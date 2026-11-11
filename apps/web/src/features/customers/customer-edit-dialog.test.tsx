import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./customer-edit-form", () => ({
  EditForm: (p: { onDone: (c: unknown) => void; onCancel: () => void }) => (
    <div>
      <button onClick={() => p.onDone({ id: "c1" })}>done</button>
      <button onClick={() => p.onCancel()}>cancel</button>
    </div>
  ),
}));

import { CustomerEditDialog } from "./customer-edit-dialog";
import type { Customer } from "./customers-api";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const customer = { id: "c1" } as unknown as Customer;

describe("CustomerEditDialog", () => {
  it("onDone forwards the customer and closes", () => {
    const onUpdated = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <CustomerEditDialog open onOpenChange={onOpenChange} customer={customer} actionConfig={cfg} onUpdated={onUpdated} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "done" }));
    expect(onUpdated).toHaveBeenCalledWith({ id: "c1" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("onCancel closes the dialog", () => {
    const onOpenChange = vi.fn();
    render(
      <CustomerEditDialog open onOpenChange={onOpenChange} customer={customer} actionConfig={cfg} onUpdated={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
