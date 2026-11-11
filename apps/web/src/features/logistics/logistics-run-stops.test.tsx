import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./logistics-media", async (orig) => ({
  ...(await orig<typeof import("./logistics-media")>()),
  AuthImage: ({ photoId, onClick }: { readonly photoId: string; readonly onClick?: () => void }) => (
    <button data-testid="stop-photo" data-id={photoId} onClick={onClick} />
  ),
}));

import { RunStops } from "./logistics-run-stops";
import type { RunStop } from "./logistics-run-types";

const config = { apiBaseUrl: "", authToken: "" };
const stop = (over: Partial<RunStop> = {}): RunStop => ({
  stopId: "s1", customerId: "c1", customerName: "Sri Laxmi", customerCode: "CUST-1",
  createdAt: "2026-09-14T03:34:00Z", latitude: 17.05, longitude: 79.28, photos: [], ...over,
});

describe("RunStops", () => {
  it("shows an empty message when there are no stops", () => {
    render(<RunStops config={config} stops={[]} onOpenPhoto={() => {}} />);
    expect(screen.getByText(/No delivery stops recorded/)).toBeInTheDocument();
  });

  it("renders each stop with a map link and pluralised count", () => {
    render(<RunStops config={config} stops={[stop(), stop({ stopId: "s2", customerName: "Balaji" })]} onOpenPhoto={() => {}} />);
    expect(screen.getByText("2 delivery stops")).toBeInTheDocument();
    expect(screen.getByText("Sri Laxmi")).toBeInTheDocument();
    expect(screen.getAllByText("View on map")).toHaveLength(2);
  });

  it("omits the map link when a stop has no coordinates", () => {
    render(<RunStops config={config} stops={[stop({ latitude: null, longitude: null })]} onOpenPhoto={() => {}} />);
    expect(screen.getByText("1 delivery stop")).toBeInTheDocument();
    expect(screen.queryByText("View on map")).not.toBeInTheDocument();
  });

  it("dashes a missing customer name and opens its photo with a blank caption", () => {
    const onOpenPhoto = vi.fn();
    render(
      <RunStops
        config={config}
        stops={[stop({ customerName: null, customerCode: null, photos: [{ id: "ph9", contentType: "image/jpeg", createdAt: "x" }] })]}
        onOpenPhoto={onOpenPhoto}
      />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("stop-photo"));
    expect(onOpenPhoto).toHaveBeenCalledWith("ph9", expect.stringContaining("photo 1"));
  });

  it("opens a photo when a thumbnail is clicked", () => {
    const onOpenPhoto = vi.fn();
    render(
      <RunStops
        config={config}
        stops={[stop({ photos: [{ id: "ph1", contentType: "image/jpeg", createdAt: "x" }] })]}
        onOpenPhoto={onOpenPhoto}
      />,
    );
    fireEvent.click(screen.getByTestId("stop-photo"));
    expect(onOpenPhoto).toHaveBeenCalledWith("ph1", expect.stringContaining("Sri Laxmi"));
  });
});
