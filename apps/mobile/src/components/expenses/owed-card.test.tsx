import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { OwedCard } from "./owed-card";

describe("OwedCard", () => {
  it("shows the owed total", () => {
    render(<OwedCard owedTotal={12450} />);
    expect(screen.getByText("Company owes you")).toBeInTheDocument();
    expect(screen.getByText("₹12,450")).toBeInTheDocument();
  });

  it("renders nothing when nothing is owed", () => {
    const { container } = render(<OwedCard owedTotal={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});
