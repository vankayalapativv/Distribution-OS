import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PhotoCaptureSheet } from "./photo-capture-sheet";

describe("PhotoCaptureSheet", () => {
  it("picks the camera (and closes first)", () => {
    const onClose = vi.fn();
    const onPick = vi.fn();
    render(<PhotoCaptureSheet visible onClose={onClose} onPick={onPick} />);
    fireEvent.click(screen.getByText("Take photo"));
    expect(onClose).toHaveBeenCalled();
    expect(onPick).toHaveBeenCalledWith("camera");
  });

  it("picks the gallery", () => {
    const onClose = vi.fn();
    const onPick = vi.fn();
    render(<PhotoCaptureSheet visible onClose={onClose} onPick={onPick} />);
    fireEvent.click(screen.getByText("From gallery"));
    expect(onClose).toHaveBeenCalled();
    expect(onPick).toHaveBeenCalledWith("gallery");
  });

  it("closes on Cancel", () => {
    const onClose = vi.fn();
    render(<PhotoCaptureSheet visible onClose={onClose} onPick={vi.fn()} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
  });

  it("stops a tap on the sheet body from closing it", () => {
    const onClose = vi.fn();
    render(<PhotoCaptureSheet visible onClose={onClose} onPick={vi.fn()} />);
    fireEvent.click(screen.getByText("Add market-intelligence photo"));
    expect(onClose).not.toHaveBeenCalled();
  });
});
