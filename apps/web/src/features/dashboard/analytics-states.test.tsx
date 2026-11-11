import { render, screen } from "@testing-library/react";
import { Truck } from "lucide-react";
import { describe, expect, it } from "vitest";
import { EmptyBlock, EmptyRow, ErrorRow, Share } from "./analytics-states";

const inTable = (node: React.ReactNode) =>
  render(<table><tbody>{node}</tbody></table>);

describe("analytics states", () => {
  it("EmptyRow renders the message with the default icon", () => {
    inTable(<EmptyRow colSpan={5} message="Nothing yet" />);
    expect(screen.getByText("Nothing yet")).toBeInTheDocument();
  });
  it("EmptyRow accepts a custom icon", () => {
    inTable(<EmptyRow colSpan={5} message="No trips" icon={Truck} />);
    expect(screen.getByText("No trips")).toBeInTheDocument();
  });
  it("ErrorRow renders a destructive message", () => {
    inTable(<ErrorRow colSpan={3} message="Failed to load" />);
    expect(screen.getByText("Failed to load").className).toContain("text-destructive");
  });
  it("EmptyBlock renders outside a table", () => {
    render(<EmptyBlock message="Empty panel" />);
    expect(screen.getByText("Empty panel")).toBeInTheDocument();
  });
});

describe("Share", () => {
  it("computes a percentage when total > 0", () => {
    render(<Share value={50} total={100} />);
    expect(screen.getByText("50%").className).toContain("text-muted-foreground");
  });
  it("shows 0% (muted grey) when total is 0", () => {
    render(<Share value={0} total={0} />);
    expect(screen.getByText("0%").className).toContain("text-slate-400");
  });
  it("keeps a minimum-width bar when the share rounds to 0 but value > 0", () => {
    const { container } = render(<Share value={1} total={1000} />);
    // pct rounds to 0, but value>0 → the bar floors at 3% width.
    expect(container.querySelector('[style*="width: 3%"]')).toBeTruthy();
  });
});
