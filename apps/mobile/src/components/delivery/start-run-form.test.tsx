import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { StartRunForm } from "./start-run-form";

const base = {
  vehicle: "",
  odo: "",
  odoPhoto: null,
  errors: {} as { vehicle?: string; odo?: string; photo?: string },
  busy: false,
  stamping: false,
  placeholder: "#999",
  error: null as string | null,
  onVehicle: vi.fn(),
  onOdo: vi.fn(),
  onAddPhoto: vi.fn(),
  onClearPhoto: vi.fn(),
  onSubmit: vi.fn(),
};

describe("StartRunForm", () => {
  it("edits vehicle + meter and submits", () => {
    const onVehicle = vi.fn();
    const onOdo = vi.fn();
    const onSubmit = vi.fn();
    render(<StartRunForm {...base} onVehicle={onVehicle} onOdo={onOdo} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText(/TS09AB1234/), { target: { value: "KA01" } });
    expect(onVehicle).toHaveBeenCalledWith("KA01");
    fireEvent.change(screen.getByPlaceholderText(/48210/), { target: { value: "500" } });
    expect(onOdo).toHaveBeenCalledWith("500");
    fireEvent.click(screen.getAllByText("Start Deliveries").at(-1) as Element);
    expect(onSubmit).toHaveBeenCalled();
  });

  it("shows field errors + a form error, and blocks submit while stamping", () => {
    const onSubmit = vi.fn();
    render(
      <StartRunForm {...base} stamping error="Could not start" errors={{ vehicle: "Required", odo: "Bad", photo: "Need a photo" }} onSubmit={onSubmit} />,
    );
    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.getByText("Bad")).toBeInTheDocument();
    expect(screen.getByText("Could not start")).toBeInTheDocument();
    fireEvent.click(screen.getAllByText("Start Deliveries").at(-1) as Element);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows a spinner instead of the button label while busy", () => {
    render(<StartRunForm {...base} busy />);
    // The button text is replaced by the ActivityIndicator (header title remains).
    expect(screen.getAllByText("Start Deliveries")).toHaveLength(1); // only the header, not the button
  });
});
