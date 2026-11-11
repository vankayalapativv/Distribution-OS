import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BeatStats, beatStats } from "./beat-stats";
import type { BeatCustomer } from "./beat-plans-api";

const cust = (weekday: number | null): BeatCustomer => ({
  customerId: Math.random().toString(), customerCode: "", legalName: "", tradeName: null, phone: null,
  city: null, segment: null, weekday, sequenceNo: 0,
});

describe("beatStats", () => {
  it("counts total / assigned / unassigned and the avg per day", () => {
    const stats = beatStats([cust(1), cust(2), cust(null)]);
    expect(stats.map((s) => s.n)).toEqual([3, 2, 1, (2 / 6).toFixed(1)]);
  });
  it("shows a 0 average when nothing is assigned", () => {
    expect(beatStats([cust(null)]).find((s) => s.l === "Avg / day")!.n).toBe("0");
  });
});

describe("BeatStats", () => {
  it("renders the four labelled figures", () => {
    render(<BeatStats customers={[cust(1), cust(null)]} />);
    for (const l of ["Customers", "Assigned", "Unassigned", "Avg / day"]) {
      expect(screen.getByText(l)).toBeInTheDocument();
    }
  });
});
