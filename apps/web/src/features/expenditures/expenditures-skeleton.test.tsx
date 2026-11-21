import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expenditureSkeleton } from "./expenditures-skeleton";

describe("expenditureSkeleton", () => {
  it("has one shimmer renderer per expenditure column, each rendering a skeleton", () => {
    expect(expenditureSkeleton).toHaveLength(8);
    for (const cell of expenditureSkeleton) {
      const { container, unmount } = render(<>{cell()}</>);
      expect(container.querySelector('[data-slot="skeleton"]')).toBeTruthy();
      unmount();
    }
  });
});
