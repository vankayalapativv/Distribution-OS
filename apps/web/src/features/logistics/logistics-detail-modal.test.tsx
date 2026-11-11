import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { CustomerDeliveryDetail } from "./logistics-api";

const detail: CustomerDeliveryDetail = {
  customer: { customerId: "c1", customerName: "Sri Laxmi", customerCode: "CUST-1", phone: "99887", address: "Main Rd", landmark: "Temple" },
  events: [
    { stopId: "s1", runId: "r1", date: "2026-09-14", createdAt: "2026-09-14T03:34:00Z",
      driverName: "Ramesh", vehicleNumber: "TS07 UB 4521", latitude: 17.05, longitude: 79.28,
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

import { LogisticsDetailModal } from "./logistics-detail-modal";

const config = { apiBaseUrl: "", authToken: "" };
const wrap = (ui: React.ReactNode) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

describe("LogisticsDetailModal", () => {
  it("renders nothing when closed", () => {
    wrap(<LogisticsDetailModal actionConfig={config} openId={null} from="" to="" onClose={() => {}} />);
    expect(screen.queryByText("Sri Laxmi")).not.toBeInTheDocument();
  });

  it("fetches and shows the customer, contact and delivery events", async () => {
    wrap(<LogisticsDetailModal actionConfig={config} openId="c1" from="" to="" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText("Sri Laxmi")).toBeInTheDocument());
    expect(screen.getByText(/Main Rd/)).toBeInTheDocument();
    expect(screen.getByText(/Temple/)).toBeInTheDocument();
    expect(screen.getByText(/99887/)).toBeInTheDocument();
    expect(screen.getByText("Ramesh")).toBeInTheDocument();
  });

  it("shows an empty message when there are no deliveries in range", async () => {
    apiGetMock.mockReturnValueOnce(Promise.resolve({ ...detail, events: [] }));
    wrap(<LogisticsDetailModal actionConfig={config} openId="c1" from="2026-09-01" to="2026-09-14" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText(/No deliveries in the selected range/)).toBeInTheDocument());
  });

  it("opens the lightbox, downloads, and closes it", async () => {
    wrap(<LogisticsDetailModal actionConfig={config} openId="c1" from="" to="" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText("Ramesh")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("img"));
    const lightbox = (await screen.findByText(/photo 1/)).parentElement as HTMLElement;
    fireEvent.click(within(lightbox).getByText("Download"));
    fireEvent.click(within(lightbox).getByText("Close"));
    await waitFor(() => expect(screen.queryByText(/photo 1/)).not.toBeInTheDocument());
  });

  it("calls onClose when the dialog is dismissed", async () => {
    const onClose = vi.fn();
    wrap(<LogisticsDetailModal actionConfig={config} openId="c1" from="" to="" onClose={onClose} />);
    await waitFor(() => expect(screen.getByText("Ramesh")).toBeInTheDocument());
    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
