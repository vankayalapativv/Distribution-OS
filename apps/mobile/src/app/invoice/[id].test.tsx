import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { router } from "expo-router";

let params: Record<string, unknown> = { id: "inv1", title: "  Invoice 42  " };
vi.mock("expo-router", () => ({ router: { back: vi.fn() }, useLocalSearchParams: () => params }));
const useInvoicePdf = vi.fn();
const useIsOnline = vi.fn(() => true);
vi.mock("../../components/invoice/use-invoice-pdf", () => ({ useInvoicePdf: (...a: unknown[]) => useInvoicePdf(...a) }));
vi.mock("../../lib/connectivity", () => ({ useIsOnline: () => useIsOnline() }));
vi.mock("../../lib/use-bottom-inset", () => ({ useBottomInset: () => 12 }));
vi.mock("react-native-pdf", () => ({ default: ({ onError }: { onError: () => void }) => <button type="button" onClick={onError}>pdf-error</button> }));
vi.mock("../../components/skeleton", () => ({ PdfPageSkeleton: () => <span>pdf-skeleton</span> }));

import InvoicePreviewScreen from "./[id]";

const pdf = (over: Record<string, unknown> = {}) =>
  ({ uri: null, state: "loading", setState: vi.fn(), sharing: false, share: vi.fn(), retry: vi.fn(), ...over });

describe("InvoicePreviewScreen", () => {
  it("shows the skeleton while loading (title trimmed)", () => {
    useInvoicePdf.mockReturnValue(pdf());
    render(<InvoicePreviewScreen />);
    expect(screen.getByText("pdf-skeleton")).toBeInTheDocument();
    expect(screen.getByText("Invoice 42")).toBeInTheDocument();
  });

  it("shows the online error with retry", () => {
    useIsOnline.mockReturnValue(true);
    const retry = vi.fn();
    useInvoicePdf.mockReturnValue(pdf({ state: "error", retry }));
    render(<InvoicePreviewScreen />);
    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Retry"));
    expect(retry).toHaveBeenCalled();
  });

  it("shows the offline error message", () => {
    useIsOnline.mockReturnValue(false);
    useInvoicePdf.mockReturnValue(pdf({ state: "error" }));
    render(<InvoicePreviewScreen />);
    expect(screen.getByText(/You're offline/)).toBeInTheDocument();
  });

  it("renders the PDF, handles a render error, shares, and goes back", () => {
    useIsOnline.mockReturnValue(true);
    (router.back as ReturnType<typeof vi.fn>).mockClear();
    const setState = vi.fn();
    const share = vi.fn();
    useInvoicePdf.mockReturnValue(pdf({ state: "ready", uri: "file://x.pdf", setState, share }));
    render(<InvoicePreviewScreen />);
    fireEvent.click(screen.getByText("pdf-error"));
    expect(setState).toHaveBeenCalledWith("error");
    fireEvent.click(screen.getByText("Share to WhatsApp"));
    expect(share).toHaveBeenCalled();
    fireEvent.click(screen.getByText("←"));
    expect(router.back).toHaveBeenCalled();
  });

  it("falls back to the default label when no title and renders nothing for a non-ready no-uri state", () => {
    params = { id: "inv1" };
    useInvoicePdf.mockReturnValue(pdf({ state: "ready", uri: null, sharing: true }));
    render(<InvoicePreviewScreen />);
    expect(screen.getAllByText("Invoice").length).toBeGreaterThan(0);
    params = { id: "inv1", title: "  Invoice 42  " };
  });
});
