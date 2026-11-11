import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BeatBoardSkeleton } from "./beat-board-skeleton";

describe("BeatBoardSkeleton", () => {
  it("mirrors the board: an Unassigned pool + all six weekday headers", () => {
    render(<BeatBoardSkeleton />);
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
    for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]) {
      expect(screen.getByText(day)).toBeInTheDocument();
    }
  });
});
