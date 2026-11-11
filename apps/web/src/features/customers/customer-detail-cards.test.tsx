import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field, InfoCard } from "./customer-detail-cards";

describe("Field", () => {
  it("shows the value when present", () => {
    render(<Field label="Phone" value="98765" />);
    expect(screen.getByText("Phone")).toBeInTheDocument();
    expect(screen.getByText("98765")).toBeInTheDocument();
  });
  it("shows an em dash when the value is null", () => {
    render(<Field label="Email" value={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

describe("InfoCard", () => {
  it("renders its title and children", () => {
    render(
      <InfoCard title="Business">
        <span>inner</span>
      </InfoCard>,
    );
    expect(screen.getByText("Business")).toBeInTheDocument();
    expect(screen.getByText("inner")).toBeInTheDocument();
  });
});
