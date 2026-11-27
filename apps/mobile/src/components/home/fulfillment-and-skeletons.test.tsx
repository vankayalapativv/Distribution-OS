import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PerformanceCardSkeleton } from "./performance-card-skeleton";
import { DuesCardSkeleton } from "./dues-card-skeleton";
import { chunkPairs, FulfillmentCardSkeleton } from "./admin-fulfillment-card-parts";
import { GROUPS, Tile } from "./admin-fulfillment-parts";

describe("chunkPairs", () => {
  it("pairs items, giving an odd trailing item its own row", () => {
    expect(chunkPairs([1, 2, 3, 4])).toEqual([[1, 2], [3, 4]]);
    expect(chunkPairs([1, 2, 3])).toEqual([[1, 2], [3]]);
    expect(chunkPairs([])).toEqual([]);
  });
});

describe("fulfillment GROUPS + Tile", () => {
  it("defines the three funnel groups", () => {
    expect(GROUPS.map((g) => g.title)).toEqual(["In progress", "Completed", "Returns"]);
  });

  it("renders a normal tile and an emphasized one", () => {
    const { rerender } = render(<Tile stage={{ key: "ordered", label: "Ordered" }} value={7} />);
    expect(screen.getByText("Ordered")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    rerender(<Tile stage={{ key: "delivered", label: "Delivered", emphasized: true }} value={12} />);
    expect(screen.getByText("Delivered")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });
});

describe("card skeletons", () => {
  it("render without crashing", () => {
    expect(render(<PerformanceCardSkeleton />).container.querySelector("div")).not.toBeNull();
    expect(render(<DuesCardSkeleton />).container.querySelector("div")).not.toBeNull();
    expect(render(<FulfillmentCardSkeleton />).container.querySelector("div")).not.toBeNull();
  });
});
