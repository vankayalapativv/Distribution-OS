import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("renders the title and body", () => {
    render(<EmptyState title="Nothing due yet" body="Come back later." />);
    expect(screen.getByText("Nothing due yet")).toBeInTheDocument();
    expect(screen.getByText("Come back later.")).toBeInTheDocument();
  });
});
