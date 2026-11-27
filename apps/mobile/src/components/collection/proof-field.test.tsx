import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProofField } from "./proof-field";

const photo = { uri: "file:///r.jpg" } as never;

describe("ProofField", () => {
  it("shows the capture buttons and forwards the source", () => {
    const onAdd = vi.fn();
    render(<ProofField photo={null} onAdd={onAdd} onRemove={() => {}} />);
    fireEvent.click(screen.getByText("Take photo"));
    expect(onAdd).toHaveBeenCalledWith("camera");
    fireEvent.click(screen.getByText("From gallery"));
    expect(onAdd).toHaveBeenCalledWith("gallery");
  });

  it("shows the preparing and uploading shimmers", () => {
    const { rerender } = render(<ProofField photo={null} preparing onAdd={() => {}} onRemove={() => {}} />);
    expect(screen.getByText("Preparing photo…")).toBeInTheDocument();
    rerender(<ProofField photo={photo} uploading onAdd={() => {}} onRemove={() => {}} />);
    expect(screen.getByText("Uploading…")).toBeInTheDocument();
  });

  it("shows the thumbnail with view + remove, and opens/closes the full-screen viewer", () => {
    const onRemove = vi.fn();
    const { container } = render(<ProofField photo={photo} onAdd={() => {}} onRemove={onRemove} />);
    expect(screen.getByText(/Proof attached/)).toBeInTheDocument();
    fireEvent.click(container.querySelector("img") as Element); // tap thumbnail → opens viewer
    fireEvent.click(screen.getByLabelText("close")); // close the viewer
    expect(screen.getByText(/Proof attached/)).toBeInTheDocument(); // back to the field
    fireEvent.click(screen.getByText("Remove"));
    expect(onRemove).toHaveBeenCalled();
  });
});
