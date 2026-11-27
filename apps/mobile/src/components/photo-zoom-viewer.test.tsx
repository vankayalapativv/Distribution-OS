import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PhotoZoomViewer } from "./photo-zoom-viewer";

describe("PhotoZoomViewer", () => {
  it("renders the image and closes on the ✕ button", () => {
    const onClose = vi.fn();
    render(<PhotoZoomViewer uri="https://example.com/p.jpg" onClose={onClose} />);
    // The close affordance is an icon with aria-label "close".
    fireEvent.click(screen.getByLabelText("close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("accepts optional auth headers without crashing", () => {
    render(
      <PhotoZoomViewer uri="https://example.com/p.jpg" headers={{ Authorization: "Bearer x" }} onClose={() => {}} />,
    );
    expect(screen.getByLabelText("close")).toBeInTheDocument();
  });
});
