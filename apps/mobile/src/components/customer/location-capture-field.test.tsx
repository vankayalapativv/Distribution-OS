import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LocationCaptureField } from "./location-capture-field";

describe("LocationCaptureField", () => {
  it("shows the idle label with a hint and captures on press", () => {
    const onPress = vi.fn();
    render(
      <LocationCaptureField
        geo={null}
        busy={false}
        onPress={onPress}
        idleLabel="Capture location"
        capturedText="Captured ✓"
        hint="Stand at the shop"
      />,
    );
    expect(screen.getByText("Capture location")).toBeInTheDocument();
    expect(screen.getByText("Stand at the shop")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Capture location"));
    expect(onPress).toHaveBeenCalled();
  });

  it("shows the captured text once geo is set", () => {
    render(
      <LocationCaptureField
        geo={{ latitude: 1, longitude: 2 }}
        busy={false}
        onPress={vi.fn()}
        idleLabel="Capture location"
        capturedText="Captured ✓"
        hint={null}
      />,
    );
    expect(screen.getByText("Captured ✓")).toBeInTheDocument();
  });

  it("shows a required marker and an error (over the hint)", () => {
    render(
      <LocationCaptureField
        geo={null}
        busy={false}
        onPress={vi.fn()}
        idleLabel="Capture location"
        capturedText="Captured ✓"
        hint="Stand at the shop"
        required
        error="Location required"
      />,
    );
    expect(screen.getByText("*")).toBeInTheDocument();
    expect(screen.getByText("Location required")).toBeInTheDocument();
    expect(screen.queryByText("Stand at the shop")).not.toBeInTheDocument();
  });

  it("shows a spinner while busy", () => {
    render(
      <LocationCaptureField
        geo={null}
        busy
        onPress={vi.fn()}
        idleLabel="Capture location"
        capturedText="Captured ✓"
        hint={null}
      />,
    );
    expect(screen.queryByText("Capture location")).not.toBeInTheDocument();
  });
});
