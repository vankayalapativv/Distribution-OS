import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const downloadPhoto = vi.fn();
vi.mock("./logistics-media", async (orig) => ({
  ...(await orig<typeof import("./logistics-media")>()),
  AuthImage: ({ onClick }: { readonly onClick?: () => void }) => <button data-testid="photo" onClick={onClick} />,
  downloadPhoto: (...a: unknown[]) => downloadPhoto(...a),
}));

import { LogisticsDetailEvent } from "./logistics-detail-event";
import type { DeliveryEvent } from "./logistics-api";

const config = { apiBaseUrl: "", authToken: "" };
const ev = (over: Partial<DeliveryEvent> = {}): DeliveryEvent => ({
  stopId: "s1", runId: "r1", date: "2026-09-14", createdAt: "2026-09-14T03:34:00Z",
  driverName: "Ramesh", vehicleNumber: "TS07 UB 4521", latitude: 17.05, longitude: 79.28, photos: [], ...over,
});

describe("LogisticsDetailEvent", () => {
  it("shows driver, vehicle, a map link and 'no photos' when empty", () => {
    render(<LogisticsDetailEvent config={config} ev={ev()} customerName="Sri Laxmi" onOpenPhoto={() => {}} />);
    expect(screen.getByText("Ramesh")).toBeInTheDocument();
    expect(screen.getByText("TS07 UB 4521")).toBeInTheDocument();
    expect(screen.getByText("View on map")).toBeInTheDocument();
    expect(screen.getByText("No photos for this delivery.")).toBeInTheDocument();
  });

  it("opens a photo when a thumbnail is clicked", () => {
    const onOpenPhoto = vi.fn();
    render(
      <LogisticsDetailEvent
        config={config}
        ev={ev({ photos: [{ id: "ph1", contentType: "image/jpeg", createdAt: "x" }] })}
        customerName="Sri Laxmi"
        onOpenPhoto={onOpenPhoto}
      />,
    );
    fireEvent.click(screen.getByTestId("photo"));
    expect(onOpenPhoto).toHaveBeenCalledWith("ph1", expect.stringContaining("Sri Laxmi"));
  });

  it("downloads a photo from its download button", () => {
    render(
      <LogisticsDetailEvent
        config={config}
        ev={ev({ photos: [{ id: "ph1", contentType: "image/jpeg", createdAt: "x" }] })}
        customerName="Sri Laxmi"
        onOpenPhoto={() => {}}
      />,
    );
    fireEvent.click(screen.getByTitle("Download"));
    expect(downloadPhoto).toHaveBeenCalled();
  });
});
