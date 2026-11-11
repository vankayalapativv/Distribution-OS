import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CustomerName, StatusChip, orderMetric } from "./customer-row-parts";
import type { CustomerRow } from "./metrics-helpers";

describe("orderMetric", () => {
  it("shows the oil litres, or a dash", () => {
    expect(orderMetric({ id: "o", code: "O", litres: 45 })).toBe("45 L");
    expect(orderMetric({ id: "o", code: "O", litres: 0 })).toBe("—");
  });
});

describe("StatusChip", () => {
  it("tones by status", () => {
    render(<><StatusChip status="verified" /><StatusChip status="rejected" /><StatusChip status="pending" /></>);
    expect(screen.getByText("verified").className).toContain("text-green-700");
    expect(screen.getByText("rejected").className).toContain("text-red-700");
    expect(screen.getByText("pending").className).toContain("text-amber-800");
  });
});

describe("CustomerName", () => {
  it("links to the customer page when an id is present", () => {
    render(<CustomerName row={{ customerId: "c1", customerName: "Ravi Motors" } as CustomerRow} />);
    expect(screen.getByRole("link", { name: "Ravi Motors" })).toHaveAttribute("href", "/customers/c1");
  });
  it("renders plain text without an id", () => {
    render(<CustomerName row={{ customerName: "Walk-in" } as CustomerRow} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Walk-in")).toBeInTheDocument();
  });
});
