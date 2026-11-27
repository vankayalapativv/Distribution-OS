import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const downloadInvoicePdf = vi.fn<(...a: unknown[]) => Promise<unknown>>();
const shareInvoiceFile = vi.fn<(...a: unknown[]) => Promise<unknown>>();
vi.mock("../../lib/invoice-notifications", () => ({
  downloadInvoicePdf: (...a: unknown[]) => downloadInvoicePdf(...a),
  shareInvoiceFile: (...a: unknown[]) => shareInvoiceFile(...a),
}));

import { useInvoicePdf } from "./use-invoice-pdf";

beforeEach(() => {
  downloadInvoicePdf.mockReset();
  shareInvoiceFile.mockReset().mockResolvedValue(undefined);
});

describe("useInvoicePdf", () => {
  it("downloads to ready, then shares the file", async () => {
    downloadInvoicePdf.mockResolvedValue("file:///inv.pdf");
    const { result } = renderHook(() => useInvoicePdf("inv1", "INV-1"));
    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(result.current.uri).toBe("file:///inv.pdf");
    expect(downloadInvoicePdf).toHaveBeenCalledWith("inv1", "INV-1");
    await act(async () => {
      await result.current.share();
    });
    expect(shareInvoiceFile).toHaveBeenCalledWith("file:///inv.pdf", "INV-1");
  });

  it("goes to error when the download fails", async () => {
    downloadInvoicePdf.mockResolvedValue(null);
    const { result } = renderHook(() => useInvoicePdf("inv1", "INV-1"));
    await waitFor(() => expect(result.current.state).toBe("error"));
    expect(result.current.uri).toBeNull();
  });

  it("does not share without a uri", async () => {
    downloadInvoicePdf.mockResolvedValue(null);
    const { result } = renderHook(() => useInvoicePdf("inv1", "INV-1"));
    await waitFor(() => expect(result.current.state).toBe("error"));
    await act(async () => {
      await result.current.share();
    });
    expect(shareInvoiceFile).not.toHaveBeenCalled();
  });

  it("ignores a second share while one is already in flight", async () => {
    downloadInvoicePdf.mockResolvedValue("file:///a.pdf");
    let resolveShare: () => void = () => {};
    shareInvoiceFile.mockReturnValue(new Promise<void>((r) => (resolveShare = r)));
    const { result } = renderHook(() => useInvoicePdf("inv1", "INV-1"));
    await waitFor(() => expect(result.current.state).toBe("ready"));
    act(() => void result.current.share()); // starts sharing (pending)
    act(() => void result.current.share()); // sharing=true → guarded, no second call
    expect(shareInvoiceFile).toHaveBeenCalledTimes(1);
    await act(async () => resolveShare());
  });

  it("retry re-runs the download", async () => {
    downloadInvoicePdf.mockResolvedValue("file:///a.pdf");
    const { result } = renderHook(() => useInvoicePdf("inv1", "INV-1"));
    await waitFor(() => expect(result.current.state).toBe("ready"));
    downloadInvoicePdf.mockClear();
    act(() => result.current.retry());
    await waitFor(() => expect(downloadInvoicePdf).toHaveBeenCalled());
  });
});
