import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn(async (..._a: unknown[]) => ({ customers: [{ id: "a" }], total: 1 }));
const downloadCustomersPdf = vi.fn(async (..._a: unknown[]) => {});
vi.mock("@/lib/api-client", () => ({ apiGet: (...a: unknown[]) => apiGet(...a) }));
vi.mock("./customers-list-pdf", () => ({ downloadCustomersPdf: (...a: unknown[]) => downloadCustomersPdf(...a) }));

import { useCustomersDownload } from "./use-customers-download";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const filters = { search: "raj", city: "", salesExecutiveId: "", dues: "" };
const execs = [{ id: "u1", name: "Ravi" }];

afterEach(() => {
  apiGet.mockClear();
  downloadCustomersPdf.mockClear();
});

describe("useCustomersDownload", () => {
  it("gathers all rows then renders the PDF, toggling busy", async () => {
    const { result } = renderHook(() => useCustomersDownload(cfg, filters, execs));
    expect(result.current.downloading).toBe(false);
    await act(async () => {
      await result.current.downloadPdf({ id: "legalName", desc: false });
    });
    expect(apiGet).toHaveBeenCalledWith(cfg, expect.stringContaining("/customers/paged?"));
    expect(downloadCustomersPdf).toHaveBeenCalledWith(
      [{ id: "a" }],
      expect.stringContaining("Search"),
      expect.any(Object),
    );
    expect(result.current.downloading).toBe(false);
  });

  it("ignores a second click while a download is already running", async () => {
    apiGet.mockImplementation(() => new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useCustomersDownload(cfg, filters, execs));
    act(() => {
      void result.current.downloadPdf(undefined);
    });
    await waitFor(() => expect(result.current.downloading).toBe(true));
    await act(async () => {
      await result.current.downloadPdf(undefined); // early return
    });
    expect(apiGet).toHaveBeenCalledTimes(1);
  });
});
