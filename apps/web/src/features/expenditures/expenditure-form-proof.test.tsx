import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = { src: null as string | null, isPdf: false, failed: false };
vi.mock("./use-bill-blob", () => ({ useBillBlob: () => state }));

import { ExpenditureFormProof } from "./expenditure-form-proof";

const config = { apiBaseUrl: "", authToken: "" };
const render1 = () => render(<ExpenditureFormProof actionConfig={config} entryId="e1" />);
afterEach(() => { state.src = null; state.isPdf = false; state.failed = false; });

describe("ExpenditureFormProof", () => {
  it("shows a shimmer while the blob loads", () => {
    const { container } = render1();
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("renders the image once loaded", () => {
    state.src = "blob:img";
    render1();
    expect(screen.getByAltText("Attached bill")).toHaveAttribute("src", "blob:img");
  });

  it("renders a PDF in a frame", () => {
    state.src = "blob:pdf"; state.isPdf = true;
    const { container } = render1();
    expect(container.querySelector("iframe")?.getAttribute("title")).toBe("Attached bill");
  });

  it("shows a fallback message when the blob fails", () => {
    state.failed = true;
    render1();
    expect(screen.getByText(/Couldn.t load the attached bill/)).toBeInTheDocument();
  });
});
