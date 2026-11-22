import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userSkeleton } from "./users-columns-skeleton";

describe("userSkeleton", () => {
  it("renders one skeleton cell per user column", () => {
    const { container } = render(<>{userSkeleton.map((cell, i) => <span key={i}>{cell()}</span>)}</>);
    // 5 columns; several carry multiple Skeleton blocks (avatar+name, contact lines).
    expect(userSkeleton).toHaveLength(5);
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThanOrEqual(5);
  });
});
