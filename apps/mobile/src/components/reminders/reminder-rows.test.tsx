import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { router } from "expo-router";
import { DoneRow, PendingRow } from "./reminder-rows";
import { RowAction } from "./row-action";

const reminder = (over: Record<string, unknown> = {}) =>
  ({ id: 7, title: "Call Acme", remindAt: 1_700_000_000_000, customerName: "Acme", ...over }) as never;

describe("RowAction", () => {
  it("renders each tone and fires onPress", () => {
    const onPress = vi.fn();
    const { rerender } = render(<RowAction icon="trash-outline" label="Delete" tone="danger" onPress={onPress} />);
    fireEvent.click(screen.getByText("Delete"));
    expect(onPress).toHaveBeenCalled();
    rerender(<RowAction icon="create-outline" label="Edit" onPress={() => {}} />); // neutral default
    expect(screen.getByText("Edit")).toBeInTheDocument();
  });
});

describe("PendingRow", () => {
  it("shows overdue + customer, and wires Done / Edit / Delete", () => {
    (router.push as ReturnType<typeof vi.fn>).mockClear?.();
    const onDone = vi.fn();
    const onDelete = vi.fn();
    render(<PendingRow r={reminder()} isOverdue onDone={onDone} onDelete={onDelete} />);
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText(/Call Acme/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Done"));
    expect(onDone).toHaveBeenCalled();
    fireEvent.click(screen.getByText("Edit"));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/reminder/new", params: { id: "7" } });
    fireEvent.click(screen.getByText("Delete"));
    expect(onDelete).toHaveBeenCalled();
  });

  it("hides the overdue label and customer suffix when not overdue / no customer", () => {
    render(<PendingRow r={reminder({ customerName: null })} isOverdue={false} onDone={() => {}} onDelete={() => {}} />);
    expect(screen.queryByText("Overdue")).not.toBeInTheDocument();
  });
});

describe("DoneRow", () => {
  it("renders a struck-through reminder with a delete action", () => {
    const onDelete = vi.fn();
    render(<DoneRow r={reminder()} onDelete={onDelete} />);
    expect(screen.getByText("Call Acme")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("trash-outline"));
    expect(onDelete).toHaveBeenCalled();
  });

  it("renders without a customer suffix", () => {
    render(<DoneRow r={reminder({ customerName: null })} onDelete={() => {}} />);
    expect(screen.getByText("Call Acme")).toBeInTheDocument();
  });
});
