import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReassignAvatar } from "./reassign-avatar";

describe("ReassignAvatar", () => {
  it("renders initials with a palette colour and the default size", () => {
    const { container } = render(<ReassignAvatar id="u1" name="Priya Field" />);
    expect(screen.getByText("PF")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("size-8");
    expect((container.firstChild as HTMLElement).className).toMatch(/bg-/);
  });

  it("accepts a custom className", () => {
    const { container } = render(<ReassignAvatar id="u1" name="x" className="size-4 text-[8px]" />);
    expect(container.firstChild).toHaveClass("size-4");
  });
});
