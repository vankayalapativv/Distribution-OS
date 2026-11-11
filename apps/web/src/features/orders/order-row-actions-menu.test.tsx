import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RowActionsMenu } from "./order-row-actions-menu";

const noop = () => {};
const baseProps = {
  canGenerate: false,
  canEdit: false,
  canManage: false,
  cancelled: false,
  fullyBilled: false,
  onGenerate: noop,
  onEdit: noop,
  onCancel: noop,
};

afterEach(() => vi.restoreAllMocks());

function open() {
  fireEvent.click(screen.getByTitle("Actions"));
}

describe("RowActionsMenu", () => {
  it("shows only the enabled actions", () => {
    render(<RowActionsMenu {...baseProps} canGenerate canEdit />);
    open();
    expect(screen.getByRole("button", { name: /Create Invoice/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Edit order/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cancel order/ })).not.toBeInTheDocument();
  });

  it("fires each handler and closes the menu", () => {
    const onGenerate = vi.fn();
    const onEdit = vi.fn();
    render(<RowActionsMenu {...baseProps} canGenerate canEdit onGenerate={onGenerate} onEdit={onEdit} />);
    open();
    fireEvent.click(screen.getByRole("button", { name: /Create Invoice/ }));
    expect(onGenerate).toHaveBeenCalled();
    open();
    fireEvent.click(screen.getByRole("button", { name: /Edit order/ }));
    expect(onEdit).toHaveBeenCalled();
  });

  it("cancel fires when manageable and enabled", () => {
    const onCancel = vi.fn();
    render(<RowActionsMenu {...baseProps} canManage onCancel={onCancel} />);
    open();
    const cancel = screen.getByRole("button", { name: /Cancel order/ });
    expect(cancel).not.toBeDisabled();
    fireEvent.click(cancel);
    expect(onCancel).toHaveBeenCalled();
  });

  it("disables Cancel when already cancelled or fully billed", () => {
    const { rerender } = render(<RowActionsMenu {...baseProps} canManage cancelled />);
    open();
    expect(screen.getByRole("button", { name: /Cancel order/ })).toBeDisabled();
    rerender(<RowActionsMenu {...baseProps} canManage fullyBilled />);
    expect(screen.getByRole("button", { name: /Cancel order/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Cancel order/ })).toHaveAttribute(
      "title",
      "Fully invoiced — nothing left to cancel",
    );
  });
});
