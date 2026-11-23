import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PanelSkeleton } from "./permission-skeleton";

describe("PanelSkeleton", () => {
  it("mirrors the panel layout with both group labels", () => {
    render(<PanelSkeleton />);
    expect(screen.getByText("Sections")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();
  });
});
