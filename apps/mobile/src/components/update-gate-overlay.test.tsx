import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { UpdateOverlay } from "./update-gate-overlay";

describe("UpdateOverlay", () => {
  it("shows the downloading phase with a version pill, percent and notes", () => {
    render(<UpdateOverlay installing={false} version="1.2.0" notes={["Faster sync", "Bug fixes"]} pct={42} />);
    expect(screen.getByText("Downloading update")).toBeInTheDocument();
    expect(screen.getByText("Updating to v1.2.0")).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.getByText("What's new")).toBeInTheDocument();
    expect(screen.getByText("Faster sync")).toBeInTheDocument();
  });

  it("shows the installing phase (no percent, restart copy)", () => {
    render(<UpdateOverlay installing version="1.2.0" notes={[]} pct={100} />);
    expect(screen.getByText("Installing update")).toBeInTheDocument();
    expect(screen.getByText(/Almost done/)).toBeInTheDocument();
    expect(screen.queryByText("100%")).not.toBeInTheDocument(); // percent hidden while installing
    expect(screen.queryByText("What's new")).not.toBeInTheDocument(); // no notes
  });

  it("renders a placeholder instead of a pill when there is no version", () => {
    render(<UpdateOverlay installing={false} version={null} notes={[]} pct={0} />);
    expect(screen.getByText("Downloading update")).toBeInTheDocument();
    expect(screen.queryByText(/Updating to v/)).not.toBeInTheDocument();
  });

  it("caps the notes list at four", () => {
    render(
      <UpdateOverlay installing={false} version="1" notes={["a", "b", "c", "d", "e"]} pct={10} />,
    );
    expect(screen.getByText("d")).toBeInTheDocument();
    expect(screen.queryByText("e")).not.toBeInTheDocument();
  });
});
