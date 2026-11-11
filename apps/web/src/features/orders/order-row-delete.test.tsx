import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OrderRowDelete } from "./order-row-delete";

describe("OrderRowDelete", () => {
  it("calls onRemove when the trash button is clicked", () => {
    const onRemove = vi.fn();
    render(<OrderRowDelete onRemove={onRemove} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove line" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("renders a spacer instead of the button when canRemove is false", () => {
    const onRemove = vi.fn();
    render(<OrderRowDelete onRemove={onRemove} canRemove={false} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
