import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AllDoneView, DeliveryLoading, IdleView } from "./delivery-states";
import { DeliveryHeader } from "./delivery-header";
import { RequiredLabel } from "./field-label";

describe("delivery headers + labels", () => {
  it("DeliveryHeader renders title + optional sub; RequiredLabel adds a star", () => {
    const { rerender } = render(<DeliveryHeader title="Deliveries" sub="Asha · Logistics" />);
    expect(screen.getByText("Deliveries")).toBeInTheDocument();
    expect(screen.getByText("Asha · Logistics")).toBeInTheDocument();
    rerender(<DeliveryHeader title="Deliveries" />);
    expect(screen.getByText("Deliveries")).toBeInTheDocument();
    render(<RequiredLabel>Vehicle</RequiredLabel>);
    expect(screen.getByText("Vehicle")).toBeInTheDocument();
    expect(screen.getByText("*")).toBeInTheDocument();
  });
});

describe("DeliveryLoading", () => {
  it("renders the spinner", () => {
    const { container } = render(<DeliveryLoading />);
    expect(container.querySelector("div")).not.toBeNull();
  });
});

describe("AllDoneView", () => {
  it("summarises the run (singular / plural / km) and finishes", () => {
    const onDone = vi.fn();
    const { rerender } = render(<AllDoneView vehicle="KA01" stops={1} km={42} onDone={onDone} />);
    expect(screen.getByText(/KA01 · 1 delivery · 42 KM/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Done"));
    expect(onDone).toHaveBeenCalled();
    rerender(<AllDoneView vehicle="KA01" stops={3} km={null} onDone={onDone} />);
    expect(screen.getByText(/3 deliveries/)).toBeInTheDocument();
    expect(screen.queryByText(/KM/)).not.toBeInTheDocument();
  });
});

describe("IdleView", () => {
  it("shows the ready state and starts deliveries", () => {
    const onStart = vi.fn();
    render(<IdleView userName="Asha" onStart={onStart} />);
    expect(screen.getByText(/Asha · Logistics/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Start Deliveries"));
    expect(onStart).toHaveBeenCalled();
  });
});
