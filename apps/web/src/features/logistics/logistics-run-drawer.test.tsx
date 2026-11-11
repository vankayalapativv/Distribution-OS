import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { RunDetail } from "./logistics-run-types";

const detail: RunDetail = {
  run: {
    runId: "r1", date: "2026-09-14", driverName: "Ramesh", vehicleNumber: "TS07 UB 4521",
    startedAt: "2026-09-14T02:42:00Z", endedAt: "2026-09-14T10:17:00Z",
    startOdometer: 45210, endOdometer: 45352, distanceKm: 142, status: "ended",
    startPhoto: null, endPhoto: null,
  },
  stops: [
    { stopId: "s1", customerId: "c1", customerName: "Sri Laxmi", customerCode: "CUST-1",
      createdAt: "2026-09-14T03:34:00Z", latitude: 17.05, longitude: 79.28,
      photos: [{ id: "ph1", contentType: "image/jpeg", createdAt: "x" }] },
  ],
};

vi.mock("@/lib/api-client", () => ({ apiGet: vi.fn(() => Promise.resolve(detail)) }));
import { apiGet } from "@/lib/api-client";
const apiGetMock = vi.mocked(apiGet);
vi.mock("./logistics-media", async (orig) => ({
  ...(await orig<typeof import("./logistics-media")>()),
  AuthImage: ({ onClick }: { readonly onClick?: () => void }) => <button data-testid="img" onClick={onClick} />,
  downloadPhoto: vi.fn(),
}));

import { LogisticsRunDrawer } from "./logistics-run-drawer";

const config = { apiBaseUrl: "", authToken: "" };
function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("LogisticsRunDrawer", () => {
  it("renders nothing when closed", () => {
    wrap(<LogisticsRunDrawer actionConfig={config} openId={null} onClose={() => {}} />);
    expect(screen.queryByText("TS07 UB 4521")).not.toBeInTheDocument();
  });

  it("shows a loading title while the run is being fetched", () => {
    apiGetMock.mockReturnValueOnce(new Promise(() => {})); // never resolves
    wrap(<LogisticsRunDrawer actionConfig={config} openId="r1" onClose={() => {}} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText("Ramesh")).not.toBeInTheDocument();
  });

  it("tolerates a run with no vehicle and no stops array", async () => {
    apiGetMock.mockReturnValueOnce(
      Promise.resolve({ run: { ...detail.run, vehicleNumber: null } } as unknown as RunDetail),
    );
    wrap(<LogisticsRunDrawer actionConfig={config} openId="r9" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText("Ramesh")).toBeInTheDocument());
    expect(screen.getByText(/No delivery stops recorded/)).toBeInTheDocument();
  });

  it("fetches the run and shows driver, vehicle, bookends and stops", async () => {
    wrap(<LogisticsRunDrawer actionConfig={config} openId="r1" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText("TS07 UB 4521")).toBeInTheDocument());
    expect(screen.getByText("Ramesh")).toBeInTheDocument();
    expect(screen.getByText("142 km")).toBeInTheDocument();
    expect(screen.getByText("Sri Laxmi")).toBeInTheDocument();
    expect(screen.getByText("1 delivery stop")).toBeInTheDocument();
  });

  it("opens a photo lightbox from a stop thumbnail and closes it", async () => {
    wrap(<LogisticsRunDrawer actionConfig={config} openId="r1" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText("Sri Laxmi")).toBeInTheDocument());
    // The first thumbnail is inside the stop; clicking it opens the lightbox caption + controls.
    const thumbs = screen.getAllByTestId("img");
    fireEvent.click(thumbs[thumbs.length - 1]);
    const lightbox = (await screen.findByText(/photo 1/)).parentElement as HTMLElement;
    fireEvent.click(within(lightbox).getByText("Download")); // exercises the download control
    fireEvent.click(within(lightbox).getByText("Close")); // the lightbox's own Close, scoped to it
    await waitFor(() => expect(screen.queryByText(/photo 1/)).not.toBeInTheDocument());
  });

  it("closes the lightbox when the backdrop is clicked", async () => {
    wrap(<LogisticsRunDrawer actionConfig={config} openId="r1" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText("Sri Laxmi")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("img"));
    const lightbox = (await screen.findByText(/photo 1/)).parentElement as HTMLElement;
    fireEvent.click(lightbox); // backdrop
    await waitFor(() => expect(screen.queryByText(/photo 1/)).not.toBeInTheDocument());
  });

  it("calls onClose when the dialog is dismissed", async () => {
    const onClose = vi.fn();
    wrap(<LogisticsRunDrawer actionConfig={config} openId="r1" onClose={onClose} />);
    await waitFor(() => expect(screen.getByText("Sri Laxmi")).toBeInTheDocument());
    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
