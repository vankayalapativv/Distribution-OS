import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { router } from "expo-router";
import { DuesCardStrip, toneForPosition } from "./dues-card-strip";
import type { DuesBucketSummary } from "../../lib/dues";

const bucket = (over: Partial<DuesBucketSummary>): DuesBucketSummary => ({
  key: "0_30",
  label: "0–30d",
  fromDays: 0,
  toDays: 30,
  customers: 3,
  outstanding: 12000,
  ...over,
});

describe("toneForPosition", () => {
  it("returns the last (most severe) tone when there is a single band", () => {
    expect(toneForPosition(0, 1)).toBe("text-red-600");
  });

  it("grades the tone by position across the bands", () => {
    expect(toneForPosition(0, 4)).toBe("text-green-600");
    expect(toneForPosition(3, 4)).toBe("text-red-600");
  });
});

describe("DuesCardStrip", () => {
  beforeEach(() => (router.push as ReturnType<typeof vi.fn>).mockClear?.());

  it("renders a column per band and navigates to the band on tap", () => {
    const buckets = [
      bucket({ key: "0_30", label: "0–30d", customers: 3 }),
      bucket({ key: "60_plus", label: "61+d", customers: 1, outstanding: 5000 }),
    ];
    render(<DuesCardStrip buckets={buckets} />);
    expect(screen.getByText("0–30d")).toBeInTheDocument();
    expect(screen.getByText("61+d")).toBeInTheDocument();
    fireEvent.click(screen.getByText("0–30d"));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/dues/[bucket]",
      params: { bucket: "0_30", label: "0–30d" },
    });
  });
});
