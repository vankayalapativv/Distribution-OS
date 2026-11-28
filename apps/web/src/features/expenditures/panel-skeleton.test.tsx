import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PanelRowsSkeleton } from "./panel-skeleton";

describe("PanelRowsSkeleton", () => {
  it("renders a labelled list with the default row count", () => {
    render(<PanelRowsSkeleton />);
    const list = screen.getByLabelText("Loading");
    expect(list.querySelectorAll("li")).toHaveLength(3);
  });

  it("honours a custom row count", () => {
    render(<PanelRowsSkeleton rows={5} />);
    expect(screen.getByLabelText("Loading").querySelectorAll("li")).toHaveLength(5);
  });
});
