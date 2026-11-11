import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./logistics-media", async (orig) => ({
  ...(await orig<typeof import("./logistics-media")>()),
  AuthImage: ({ photoId }: { readonly photoId: string }) => <div data-testid="odo-photo" data-id={photoId} />,
}));

import { RunBookends } from "./logistics-run-bookends";
import type { RunDetail } from "./logistics-run-types";

const config = { apiBaseUrl: "", authToken: "" };
const endedRun: RunDetail["run"] = {
  runId: "r1", date: "2026-09-14", driverName: "Ramesh", vehicleNumber: "TS07 UB 4521",
  startedAt: "2026-09-14T02:42:00Z", endedAt: "2026-09-14T10:17:00Z",
  startOdometer: 45210, endOdometer: 45352, distanceKm: 142, status: "ended",
  startPhoto: { id: "p-start", contentType: "image/jpeg" }, endPhoto: { id: "p-end", contentType: null },
};

describe("RunBookends", () => {
  it("shows start/end odometers, distance, duration and both photos for an ended run", () => {
    render(<RunBookends config={config} run={endedRun} />);
    expect(screen.getByText("Odometer 45,210 km")).toBeInTheDocument();
    expect(screen.getByText("Odometer 45,352 km")).toBeInTheDocument();
    expect(screen.getByText("142 km")).toBeInTheDocument();
    expect(screen.getByText("7h 35m")).toBeInTheDocument();
    expect(screen.getByText("Duration")).toBeInTheDocument();
    expect(screen.getAllByTestId("odo-photo")).toHaveLength(2);
  });

  it("shows an on-the-road end and pending photo for an active run", () => {
    render(
      <RunBookends
        config={config}
        run={{ ...endedRun, endedAt: null, endOdometer: null, distanceKm: null, status: "active", endPhoto: null }}
      />,
    );
    expect(screen.getByText("On the road")).toBeInTheDocument();
    expect(screen.getByText("Pending — run active")).toBeInTheDocument();
    expect(screen.getByText("Elapsed")).toBeInTheDocument();
    // both the end-time and the distance show an em-dash for an active run
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("falls back when odometers and photos are missing", () => {
    render(
      <RunBookends
        config={config}
        run={{ ...endedRun, startOdometer: null, startPhoto: null }}
      />,
    );
    expect(screen.getByText("No odometer")).toBeInTheDocument();
    expect(screen.getByText("No start photo")).toBeInTheDocument();
  });

  it("shows a dash duration when the timestamps are unusable", () => {
    render(<RunBookends config={config} run={{ ...endedRun, startedAt: "bad", endedAt: "worse" }} />);
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("falls back on the end card when an ended run lacks end odometer/photo", () => {
    render(
      <RunBookends
        config={config}
        run={{ ...endedRun, endOdometer: null, endPhoto: null }}
      />,
    );
    expect(screen.getByText("No odometer")).toBeInTheDocument();
    expect(screen.getByText("No end photo")).toBeInTheDocument();
  });
});
