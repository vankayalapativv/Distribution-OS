import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DuesExecFilter } from "./dues-exec-filter";

const execs = [
  { id: "e1", name: "Asha" },
  { id: "e2", name: "Bina" },
] as never[];

describe("DuesExecFilter", () => {
  it("renders the All + exec chips and selects one (then back to all)", () => {
    const setExecId = vi.fn();
    render(<DuesExecFilter execs={execs} execsLoading={false} execId={null} setExecId={setExecId} />);
    expect(screen.getByText("All executives")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Asha"));
    expect(setExecId).toHaveBeenCalledWith("e1");
    fireEvent.click(screen.getByText("All executives"));
    expect(setExecId).toHaveBeenCalledWith(null);
  });

  it("shows shimmer chips while the exec list is still loading", () => {
    const { container } = render(<DuesExecFilter execs={[]} execsLoading execId={null} setExecId={() => {}} />);
    expect(screen.getByText("All executives")).toBeInTheDocument();
    expect(container.querySelectorAll("div").length).toBeGreaterThan(1);
  });
});
