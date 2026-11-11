import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./customer-status-form", () => ({
  StatusForm: (p: { onDone: (c: unknown) => void; onCancel: () => void }) => (
    <div>
      <button onClick={() => p.onDone({ id: "c1" })}>done</button>
      <button onClick={() => p.onCancel()}>cancel</button>
    </div>
  ),
}));

import { CustomerStatusDialog } from "./customer-status-dialog";
import type { Customer } from "./customers-api";

const customer = { id: "c1" } as unknown as Customer;
const cfg = { apiBaseUrl: "x", authToken: "t" };

describe("CustomerStatusDialog", () => {
  it("onDone forwards the customer and closes", () => {
    const onUpdated = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <CustomerStatusDialog open onOpenChange={onOpenChange} customer={customer} actionConfig={cfg} onUpdated={onUpdated} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "done" }));
    expect(onUpdated).toHaveBeenCalledWith({ id: "c1" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("onCancel closes the dialog", () => {
    const onOpenChange = vi.fn();
    render(
      <CustomerStatusDialog open onOpenChange={onOpenChange} customer={customer} actionConfig={cfg} onUpdated={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
