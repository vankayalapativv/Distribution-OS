import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const downloadOrdersPdf = vi.fn();
const downloadOrdersExcel = vi.fn();

/* eslint-disable @typescript-eslint/no-explicit-any */
vi.mock("./orders-export", () => ({
  downloadOrdersPdf: (...a: unknown[]) => downloadOrdersPdf(...a),
  downloadOrdersExcel: (...a: unknown[]) => downloadOrdersExcel(...a),
  ORDER_EXPORT_STATUSES: [
    { value: "all", label: "All statuses" },
    { value: "delivered", label: "Delivered" },
  ],
}));
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ onOpenChange, children }: any) => (
    <div>
      {children}
      <button onClick={() => onOpenChange(true)}>pop-open</button>
      <button onClick={() => onOpenChange(false)}>pop-close</button>
    </div>
  ),
  PopoverTrigger: ({ children }: any) => <div>{children}</div>,
  PopoverContent: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("@/components/ui/search-select", () => ({
  SearchSelect: ({ items, valueKey, getKey, getLabel, onSelect }: any) => {
    const sel = items.find((i: any) => getKey(i) === valueKey);
    return (
      <div data-testid="select" data-value={valueKey}>
        <span data-testid="select-value">{sel ? getLabel(sel) : ""}</span>
        <button onClick={() => onSelect("delivered")}>set-delivered</button>
        <button onClick={() => onSelect("")}>set-empty</button>
      </div>
    );
  },
}));
/* eslint-enable @typescript-eslint/no-explicit-any */

import { OrdersDownload } from "./orders-download";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const filters = { search: "widget", city: "", salesExecutiveId: "", dateFrom: "", dateTo: "" };
const setup = (defaultFulfillment?: string) =>
  render(<OrdersDownload actionConfig={cfg} filters={filters} defaultFulfillment={defaultFulfillment} />);

afterEach(() => {
  downloadOrdersPdf.mockReset();
  downloadOrdersExcel.mockReset();
  vi.restoreAllMocks();
});

describe("OrdersDownload", () => {
  it("shows the current status label", () => {
    setup("delivered");
    expect(screen.getByTestId("select-value")).toHaveTextContent("Delivered");
  });

  it("exports a PDF carrying the filters + chosen status", async () => {
    downloadOrdersPdf.mockResolvedValue(undefined);
    setup();
    fireEvent.click(screen.getByRole("button", { name: "PDF" }));
    await waitFor(() =>
      expect(downloadOrdersPdf).toHaveBeenCalledWith(cfg, { ...filters, fulfillment: "all" }),
    );
  });

  it("exports an Excel workbook", async () => {
    downloadOrdersExcel.mockResolvedValue(undefined);
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Excel" }));
    await waitFor(() => expect(downloadOrdersExcel).toHaveBeenCalled());
  });

  it("changes the status, ignoring a blank selection", async () => {
    downloadOrdersPdf.mockResolvedValue(undefined);
    setup();
    fireEvent.click(screen.getByRole("button", { name: "set-empty" })); // ignored (v && …)
    fireEvent.click(screen.getByRole("button", { name: "set-delivered" }));
    fireEvent.click(screen.getByRole("button", { name: "PDF" }));
    await waitFor(() =>
      expect(downloadOrdersPdf).toHaveBeenCalledWith(cfg, { ...filters, fulfillment: "delivered" }),
    );
  });

  it("shows a busy label + disables both buttons while exporting", () => {
    downloadOrdersPdf.mockReturnValue(new Promise(() => {}));
    setup();
    fireEvent.click(screen.getByRole("button", { name: "PDF" }));
    expect(screen.getByRole("button", { name: "Exporting…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Excel" })).toBeDisabled();
  });

  it("surfaces an error when the export fails, cleared on close", async () => {
    downloadOrdersPdf.mockRejectedValue(new Error("nope"));
    setup();
    fireEvent.click(screen.getByRole("button", { name: "PDF" }));
    await waitFor(() => expect(screen.getByText(/Download failed/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "pop-close" }));
    expect(screen.queryByText(/Download failed/)).not.toBeInTheDocument();
  });

  it("resets the status to the page default when re-opened", async () => {
    setup("delivered");
    fireEvent.click(screen.getByRole("button", { name: "set-empty" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "pop-open" }));
    });
    expect(screen.getByTestId("select")).toHaveAttribute("data-value", "delivered");
  });

  it("re-opens to 'all' when the page has no default status", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "set-delivered" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "pop-open" }));
    });
    expect(screen.getByTestId("select")).toHaveAttribute("data-value", "all");
  });
});
