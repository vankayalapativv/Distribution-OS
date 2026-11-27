import { describe, expect, it, vi } from "vitest";
vi.mock("../../lib/admin-tracking", () => ({ isLive: (e: { live?: boolean }) => Boolean(e.live) }));

import { fireEvent, render, screen } from "@testing-library/react";
import { TrackingRepStrip } from "./tracking-rep-strip";

const rep = (over: Record<string, unknown> = {}) => ({
  userId: "u1",
  name: "Asha",
  lastLatitude: 17.4,
  lastLongitude: 78.5,
  live: true,
  ...over,
});

describe("TrackingRepStrip", () => {
  it("shows skeleton chips while loading", () => {
    const { container } = render(<TrackingRepStrip loading execs={[]} selectedId={null} setSelectedId={() => {}} />);
    expect(container.querySelector("div")).not.toBeNull();
    expect(screen.queryByText("No tracking for this day.")).not.toBeInTheDocument();
  });

  it("shows the empty message when there is no tracking", () => {
    render(<TrackingRepStrip loading={false} execs={[]} selectedId={null} setSelectedId={() => {}} />);
    expect(screen.getByText("No tracking for this day.")).toBeInTheDocument();
  });

  it("selects a positioned rep and clears on re-tap; dims a rep with no position", () => {
    const setSelectedId = vi.fn();
    render(
      <TrackingRepStrip
        loading={false}
        execs={[rep() as never, rep({ userId: "u2", name: "Bina", lastLatitude: null, lastLongitude: null, live: false }) as never]}
        selectedId="u1"
        setSelectedId={setSelectedId}
      />,
    );
    fireEvent.click(screen.getByText("Asha")); // already selected → clears
    expect(setSelectedId).toHaveBeenCalledWith(null);
    fireEvent.click(screen.getByText("Bina")); // no position → disabled, no call
    expect(setSelectedId).toHaveBeenCalledTimes(1);
  });

  it("selects an unselected rep", () => {
    const setSelectedId = vi.fn();
    render(<TrackingRepStrip loading={false} execs={[rep() as never]} selectedId={null} setSelectedId={setSelectedId} />);
    fireEvent.click(screen.getByText("Asha"));
    expect(setSelectedId).toHaveBeenCalledWith("u1");
  });
});
