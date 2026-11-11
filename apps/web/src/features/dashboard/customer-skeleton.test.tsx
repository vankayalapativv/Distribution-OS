import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CustomerSkeleton } from "./customer-skeleton";

describe("CustomerSkeleton", () => {
  it("renders the visit-shaped skeleton for visit metrics", () => {
    const { container } = render(<CustomerSkeleton metric="visits" />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
    expect(container.querySelectorAll(".flex-col").length).toBeGreaterThan(0);
  });
  it("renders the executives-shaped skeleton", () => {
    const { container } = render(<CustomerSkeleton metric="executives" />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });
  it("renders the value-shaped skeleton for litres", () => {
    const { container } = render(<CustomerSkeleton metric="litres" />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });
  it("uses the pill variant for collections", () => {
    const { container } = render(<CustomerSkeleton metric="collections" />);
    expect(container.querySelector(".rounded-full")).toBeTruthy();
  });
});
