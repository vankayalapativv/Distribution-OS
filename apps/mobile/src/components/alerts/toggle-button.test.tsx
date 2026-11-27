import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ToggleButton } from "./toggle-button";

describe("ToggleButton", () => {
  it("renders the label + unread badge and fires onPress", () => {
    const onPress = vi.fn();
    render(<ToggleButton label="Dues" on count={4} onPress={onPress} />);
    expect(screen.getByText("Dues")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Dues"));
    expect(onPress).toHaveBeenCalled();
  });

  it("hides the badge when the count is zero", () => {
    render(<ToggleButton label="Invoices" on={false} count={0} onPress={() => {}} />);
    expect(screen.getByText("Invoices")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
