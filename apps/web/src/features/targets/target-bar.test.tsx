import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Bar } from "./target-bar";

const fmt = (v: number) => `${v} L`;

describe("Bar", () => {
  it("shows actual / target and a tier-coloured fill at the clamped width", () => {
    const { container } = render(<Bar label="Car" actual={30} target={60} format={fmt} />);
    expect(screen.getByText("Car")).toBeInTheDocument();
    expect(screen.getByText("30 L")).toBeInTheDocument();
    expect(screen.getByText("/ 60 L")).toBeInTheDocument();
    const fill = container.querySelector("div.rounded-full.bg-amber-500") as HTMLElement; // 50% → amber
    expect(fill).toBeTruthy();
    expect(fill.style.width).toBe("50%");
  });

  it("caps the bar at 100%", () => {
    const { container } = render(<Bar label="Car" actual={200} target={100} format={fmt} />);
    expect((container.querySelector("div.bg-green-600") as HTMLElement).style.width).toBe("100%");
  });

  it("renders a muted no-target bar when target is null or 0", () => {
    const { container } = render(<Bar label="Car" actual={5} target={null} format={fmt} />);
    expect(container.querySelector("div.bg-muted")).toBeTruthy();
    expect(screen.queryByText(/\//)).not.toBeInTheDocument();
  });
});
