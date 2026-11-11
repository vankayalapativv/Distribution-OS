import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProofPicker } from "./collection-proof-picker";

beforeEach(() => {
  vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());

const imageFile = new File(["x"], "receipt.png", { type: "image/png" });
const pdfFile = new File(["x"], "receipt.pdf", { type: "application/pdf" });

describe("ProofPicker", () => {
  it("shows the upload prompt when no file is chosen", () => {
    render(<ProofPicker file={null} onChange={() => {}} />);
    expect(screen.getByText(/Upload receipt photo or PDF/)).toBeInTheDocument();
  });

  it("selects a file through the input", () => {
    const onChange = vi.fn();
    const { container } = render(<ProofPicker file={null} onChange={onChange} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [imageFile] } });
    expect(onChange).toHaveBeenCalledWith(imageFile);
  });

  it("previews an image file and removes it", () => {
    const onChange = vi.fn();
    render(<ProofPicker file={imageFile} onChange={onChange} />);
    expect(screen.getByText("receipt.png")).toBeInTheDocument();
    expect(screen.getByAltText("Proof preview")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Remove proof"));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("shows a file icon (no preview) for a PDF", () => {
    render(<ProofPicker file={pdfFile} onChange={() => {}} />);
    expect(screen.getByText("receipt.pdf")).toBeInTheDocument();
    expect(screen.queryByAltText("Proof preview")).not.toBeInTheDocument();
  });
});
