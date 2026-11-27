import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ALPHABET, AzIndex } from "./az-index";

describe("AzIndex", () => {
  it("has 27 rail letters (A–Z + #)", () => {
    expect(ALPHABET).toHaveLength(27);
    expect(ALPHABET[26]).toBe("#");
  });

  it("jumps to a present letter and ignores an absent (disabled) one", () => {
    const onJump = vi.fn();
    render(<AzIndex presentLetters={new Set(["A", "M"])} onJump={onJump} />);
    fireEvent.click(screen.getByText("M")); // present → jumps
    expect(onJump).toHaveBeenCalledWith("M");
    fireEvent.click(screen.getByText("Z")); // absent → disabled, no jump
    expect(onJump).toHaveBeenCalledTimes(1);
  });
});
