import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskDeleteSection } from "./task-delete-section";

const base = { confirming: false, setConfirming: vi.fn(), deleting: false, onDelete: vi.fn() };

describe("TaskDeleteSection", () => {
  it("shows a Delete trigger that asks for confirmation", () => {
    const setConfirming = vi.fn();
    render(<TaskDeleteSection {...base} setConfirming={setConfirming} />);
    fireEvent.click(screen.getByText("Delete task"));
    expect(setConfirming).toHaveBeenCalledWith(true);
  });

  it("confirms the permanent delete and can back out", () => {
    const onDelete = vi.fn();
    const setConfirming = vi.fn();
    render(<TaskDeleteSection {...base} confirming setConfirming={setConfirming} onDelete={onDelete} />);
    expect(screen.getByText(/Delete this task permanently/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Delete permanently"));
    expect(onDelete).toHaveBeenCalled();
    fireEvent.click(screen.getByText("Cancel"));
    expect(setConfirming).toHaveBeenCalledWith(false);
  });

  it("shows a busy label while deleting", () => {
    render(<TaskDeleteSection {...base} confirming deleting />);
    expect(screen.getByText("Deleting…")).toBeDisabled();
  });
});
