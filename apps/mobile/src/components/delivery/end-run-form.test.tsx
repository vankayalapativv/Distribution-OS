import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { EndRunForm } from "./end-run-form";

const base = {
  stopsDone: 2,
  endOdo: "",
  endPhoto: null,
  errors: {} as { odo?: string; photo?: string },
  busy: false,
  stamping: false,
  placeholder: "#999",
  error: null as string | null,
  onEndOdo: vi.fn(),
  onAddPhoto: vi.fn(),
  onClearPhoto: vi.fn(),
  onBack: vi.fn(),
  onSubmit: vi.fn(),
};

describe("EndRunForm", () => {
  it("edits the closing meter, goes back, and ends the run", () => {
    const onEndOdo = vi.fn();
    const onBack = vi.fn();
    const onSubmit = vi.fn();
    render(<EndRunForm {...base} onEndOdo={onEndOdo} onBack={onBack} onSubmit={onSubmit} />);
    expect(screen.getByText(/2 deliveries done/)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/48297/), { target: { value: "48297" } });
    expect(onEndOdo).toHaveBeenCalledWith("48297");
    fireEvent.click(screen.getByText("Back"));
    expect(onBack).toHaveBeenCalled();
    fireEvent.click(screen.getAllByText("End Deliveries").at(-1) as Element);
    expect(onSubmit).toHaveBeenCalled();
  });

  it("uses the singular count, shows errors, and blocks End while stamping", () => {
    const onSubmit = vi.fn();
    render(<EndRunForm {...base} stopsDone={1} stamping error="Oops" errors={{ odo: "Bad" }} onSubmit={onSubmit} />);
    expect(screen.getByText(/1 delivery done/)).toBeInTheDocument();
    expect(screen.getByText("Bad")).toBeInTheDocument();
    expect(screen.getByText("Oops")).toBeInTheDocument();
    fireEvent.click(screen.getAllByText("End Deliveries").at(-1) as Element);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows a spinner instead of the button label while busy", () => {
    render(<EndRunForm {...base} busy />);
    expect(screen.getAllByText("End Deliveries")).toHaveLength(1); // header only, button shows the spinner
  });
});
