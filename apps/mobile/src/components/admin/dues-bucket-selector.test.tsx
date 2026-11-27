import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DuesBucketSelector } from "./dues-bucket-selector";

const bucket = (key: string, label: string, customers: number, outstanding: number) =>
  ({ key, label, fromDays: 0, toDays: null, customers, outstanding }) as never;

describe("DuesBucketSelector", () => {
  it("renders band counts/labels and selects a band", () => {
    const setBucket = vi.fn();
    render(
      <DuesBucketSelector
        buckets={[bucket("b1", "0–30d", 3, 8000), bucket("b2", "61+d", 1, 2000)]}
        bucket="b1"
        setBucket={setBucket}
        loading={false}
      />,
    );
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("0–30d")).toBeInTheDocument();
    fireEvent.click(screen.getByText("61+d"));
    expect(setBucket).toHaveBeenCalledWith("b2");
  });

  it("renders skeleton cells before the bands arrive", () => {
    const { container } = render(
      <DuesBucketSelector buckets={[]} bucket="" setBucket={() => {}} loading />,
    );
    expect(container.querySelectorAll("div").length).toBeGreaterThan(0);
    expect(screen.queryByText("0–30d")).not.toBeInTheDocument();
  });

  it("uses the most-severe tone for a single band", () => {
    render(
      <DuesBucketSelector buckets={[bucket("only", "All", 5, 9000)]} bucket="only" setBucket={() => {}} loading={false} />,
    );
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });
});
