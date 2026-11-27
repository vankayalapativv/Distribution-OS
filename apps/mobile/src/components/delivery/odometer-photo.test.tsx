import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { OdometerPhoto } from "./odometer-photo";

const photo = { uri: "file:///m.jpg" } as never;

describe("OdometerPhoto", () => {
  it("shows the Take-photo button and an error", () => {
    const onCamera = vi.fn();
    render(<OdometerPhoto photo={null} error="Required" onCamera={onCamera} onClear={() => {}} />);
    expect(screen.getByText("Required")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Take photo"));
    expect(onCamera).toHaveBeenCalled();
  });

  it("shows the busy shimmer", () => {
    const { container } = render(<OdometerPhoto photo={null} busy onCamera={() => {}} onClear={() => {}} />);
    expect(container.querySelector("div")).not.toBeNull();
    expect(screen.queryByText("Take photo")).not.toBeInTheDocument();
  });

  it("shows the captured tile with view + clear and opens/closes the viewer", () => {
    const onClear = vi.fn();
    render(<OdometerPhoto photo={photo} onCamera={() => {}} onClear={onClear} />);
    fireEvent.click(screen.getByLabelText("View photo")); // opens zoom viewer
    fireEvent.click(screen.getByLabelText("close")); // close it
    fireEvent.click(screen.getByText("✕")); // remove
    expect(onClear).toHaveBeenCalled();
  });
});
