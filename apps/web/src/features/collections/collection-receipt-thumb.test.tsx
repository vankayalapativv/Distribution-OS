import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CollectionReceiptThumb } from "./collection-receipt-thumb";

describe("CollectionReceiptThumb", () => {
  it("shows a failure message when the load failed", () => {
    render(<CollectionReceiptThumb src={null} failed isPdf={false} onEnlarge={() => {}} />);
    expect(screen.getByText(/Couldn.t load the receipt/)).toBeInTheDocument();
  });

  it("shows a loading placeholder while there is no src", () => {
    const { container } = render(<CollectionReceiptThumb src={null} failed={false} isPdf={false} onEnlarge={() => {}} />);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("opens a PDF in a new tab", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<CollectionReceiptThumb src="blob:x" failed={false} isPdf onEnlarge={() => {}} />);
    fireEvent.click(screen.getByTitle("Open PDF in a new tab"));
    expect(open).toHaveBeenCalledWith("blob:x", "_blank", "noopener");
    open.mockRestore();
  });

  it("enlarges an image on click", () => {
    const onEnlarge = vi.fn();
    render(<CollectionReceiptThumb src="blob:x" failed={false} isPdf={false} onEnlarge={onEnlarge} />);
    fireEvent.click(screen.getByAltText("Payment receipt"));
    expect(onEnlarge).toHaveBeenCalled();
  });
});
