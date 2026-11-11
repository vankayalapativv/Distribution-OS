import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./customer-detail-sections", () => ({
  INFO_TABS: [{ key: "details", label: "Details", render: () => <div>info-render</div> }],
}));
vi.mock("./customer-photos-tab", () => ({ CustomerPhotosTab: () => <div>photos-tab</div> }));
vi.mock("./customer-orders-tab", () => ({ CustomerOrdersTab: () => <div>orders-tab</div> }));
vi.mock("./customer-ledger-tab", () => ({ CustomerLedgerTab: () => <div>ledger-tab</div> }));
vi.mock("./customer-visits-tab", () => ({ CustomerVisitsTab: () => <div>visits-tab</div> }));
vi.mock("./customer-notes-tab", () => ({ CustomerNotesTab: () => <div>notes-tab</div> }));

import { CustomerDetailTabContent } from "./customer-detail-tab-content";
import type { Customer } from "./customers-api";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const props = {
  customer: { id: "c1", legalName: "Raj" } as unknown as Customer,
  role: "SUPER_ADMIN" as const,
  actionConfig: cfg,
  canEdit: true,
  orders: [],
  ordersTotal: 0,
  ordersLoading: false,
  photos: [],
  photosLoading: false,
};

describe("CustomerDetailTabContent", () => {
  it.each([
    ["orders", "orders-tab"],
    ["ledger", "ledger-tab"],
    ["notes", "notes-tab"],
    ["visits", "visits-tab"],
    ["photos", "photos-tab"],
    ["details", "info-render"],
  ])("renders %s → %s", (activeTab, text) => {
    render(<CustomerDetailTabContent {...props} activeTab={activeTab} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });
});
