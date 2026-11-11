import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BucketTile, DuesTotalTile } from "./dues-card-parts";
import type { DuesBucket } from "./dues-helpers";

const bucket: DuesBucket = { key: "0_30", label: "0–30d", customers: 3, outstanding: 12000 };

describe("dues card parts", () => {
  it("BucketTile shows the bucket and calls onOpen when clicked (plural)", () => {
    const onOpen = vi.fn();
    render(<BucketTile bucket={bucket} onOpen={onOpen} />);
    expect(screen.getByText("0–30d")).toBeInTheDocument();
    expect(screen.getByText("3 customers")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledWith(bucket);
  });

  it("BucketTile uses the singular noun for one customer", () => {
    render(<BucketTile bucket={{ ...bucket, customers: 1 }} onOpen={vi.fn()} />);
    expect(screen.getByText("1 customer")).toBeInTheDocument();
  });

  it("BucketTile keeps its label but shimmers only the numbers while loading", () => {
    render(<BucketTile bucket={bucket} onOpen={vi.fn()} loading />);
    // Label stays constant…
    expect(screen.getByText("0–30d")).toBeInTheDocument();
    // …but the amount + customer count are replaced by shimmers, and it's inert.
    expect(screen.queryByText("3 customers")).not.toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("DuesTotalTile shows the total and how many owe", () => {
    render(<DuesTotalTile outstanding={50000} customers={7} />);
    expect(screen.getByText("Total dues")).toBeInTheDocument();
    expect(screen.getByText("7 owe")).toBeInTheDocument();
  });

  it("DuesTotalTile keeps 'Total dues' but shimmers the amount while loading", () => {
    render(<DuesTotalTile outstanding={50000} customers={7} loading />);
    expect(screen.getByText("Total dues")).toBeInTheDocument();
    expect(screen.queryByText("7 owe")).not.toBeInTheDocument();
  });
});
