import { afterEach, describe, expect, it, vi } from "vitest";

const fetchAllOrders = vi.fn();
const downloadTablePdf = vi.fn();
const writeFile = vi.fn();
const aoa_to_sheet = vi.fn((..._a: unknown[]) => ({}));
const book_new = vi.fn(() => ({}));
const book_append_sheet = vi.fn();

vi.mock("./orders-export-fetch", () => ({ fetchAllOrders: (...a: unknown[]) => fetchAllOrders(...a) }));
vi.mock("@/lib/pdf-doc", () => ({ downloadTablePdf: (...a: unknown[]) => downloadTablePdf(...a) }));
vi.mock("xlsx", () => ({ utils: { book_new, aoa_to_sheet, book_append_sheet }, writeFile }));

import { downloadOrdersPdf, downloadOrdersExcel, ORDER_EXPORT_STATUSES } from "./orders-export";
import type { Order } from "./orders-api";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const order = (over: Partial<Order> = {}): Order =>
  ({ orderCode: "ORD-1", orderDate: "2026-08-01", fulfillmentStatus: "ordered", items: [], ...over }) as Order;

afterEach(() => {
  fetchAllOrders.mockReset();
  downloadTablePdf.mockReset();
  writeFile.mockReset();
});

describe("ORDER_EXPORT_STATUSES", () => {
  it("leads with All statuses and includes every ladder stage", () => {
    expect(ORDER_EXPORT_STATUSES[0]).toEqual({ value: "all", label: "All statuses" });
    expect(ORDER_EXPORT_STATUSES.map((s) => s.value)).toContain("delivered");
  });
});

describe("downloadOrdersPdf", () => {
  it("numbers the rows and names the file by the chosen status", async () => {
    fetchAllOrders.mockResolvedValue([order(), order()]);
    await downloadOrdersPdf(cfg, { fulfillment: "invoiced" });
    const arg = downloadTablePdf.mock.calls[0][0];
    expect(arg.fileName).toBe("Orders - Invoiced.pdf");
    expect(arg.head[0]).toBe("#");
    expect(arg.body[0][0]).toBe("1");
    expect(arg.metaLine).toContain("2 orders");
  });

  it("labels 'All statuses' and singularises one order", async () => {
    fetchAllOrders.mockResolvedValue([order()]);
    await downloadOrdersPdf(cfg, { fulfillment: "all" });
    const arg = downloadTablePdf.mock.calls[0][0];
    expect(arg.fileName).toBe("Orders - All statuses.pdf");
    expect(arg.metaLine).toContain("1 order ·");
  });

  it("labels 'All statuses' for a blank status and echoes an unknown one", async () => {
    fetchAllOrders.mockResolvedValue([]);
    await downloadOrdersPdf(cfg, { fulfillment: "" });
    expect(downloadTablePdf.mock.calls[0][0].fileName).toBe("Orders - All statuses.pdf");
    await downloadOrdersPdf(cfg, { fulfillment: "weird" });
    expect(downloadTablePdf.mock.calls[1][0].fileName).toBe("Orders - weird.pdf");
  });
});

describe("downloadOrdersExcel", () => {
  it("writes a workbook with a header row + one row per order", async () => {
    fetchAllOrders.mockResolvedValue([order()]);
    await downloadOrdersExcel(cfg, { fulfillment: "delivered" });
    expect(aoa_to_sheet).toHaveBeenCalled();
    const aoa = aoa_to_sheet.mock.calls[0][0] as unknown[][];
    expect(aoa[0][0]).toBe("Order code"); // header
    expect(aoa).toHaveLength(2); // header + 1 order
    expect(writeFile).toHaveBeenCalledWith(expect.anything(), "Orders - Delivered.xlsx");
  });
});
