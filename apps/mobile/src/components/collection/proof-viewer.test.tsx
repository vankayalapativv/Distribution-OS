import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProofViewer } from "./proof-viewer";

describe("ProofViewer", () => {
  it("closes on the ✕ button", () => {
    const onClose = vi.fn();
    render(<ProofViewer uri="file:///receipt.jpg" onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("close"));
    expect(onClose).toHaveBeenCalled();
  });
});
