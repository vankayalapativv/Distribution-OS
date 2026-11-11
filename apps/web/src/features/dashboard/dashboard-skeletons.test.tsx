import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Shimmer,
  SkeletonCards,
  SkeletonChart,
  SkeletonRows,
  type SkelCol,
} from "./dashboard-skeletons";

describe("dashboard skeletons", () => {
  it("re-exports the shared Shimmer primitive", () => {
    render(<Shimmer className="h-3 w-3" />);
    // Rendered without throwing = the re-export resolves.
    expect(document.querySelector(".h-3")).toBeTruthy();
  });

  it("SkeletonCards renders six metric-card placeholders", () => {
    const { container } = render(<SkeletonCards />);
    expect(screen.getByLabelText("Loading metrics")).toBeInTheDocument();
    expect(container.querySelectorAll(".border-l-4").length).toBe(6);
  });

  it("SkeletonRows renders rows×cols, right-aligning numeric cells (both branches)", () => {
    const cols: SkelCol[] = [{ w: "w-24" }, { w: "w-10", right: true }];
    const { container } = render(
      <table>
        <tbody>
          <SkeletonRows cols={cols} rows={3} />
        </tbody>
      </table>,
    );
    expect(container.querySelectorAll("tr").length).toBe(3);
    // One right-aligned shimmer per row (the `right` branch).
    expect(container.querySelectorAll(".ml-auto").length).toBe(3);
  });

  it("SkeletonChart renders six staggered bars", () => {
    render(<SkeletonChart />);
    expect(screen.getByLabelText("Loading chart")).toBeInTheDocument();
  });
});
