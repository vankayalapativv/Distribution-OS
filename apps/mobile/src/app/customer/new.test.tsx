import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { router } from "expo-router";

const useNewCustomerForm = vi.fn();
vi.mock("../../lib/customer/use-new-customer-form", () => ({ useNewCustomerForm: () => useNewCustomerForm() }));
vi.mock("../../lib/use-bottom-inset", () => ({ useBottomInset: () => 12 }));
vi.mock("../../components/customer/new/new-customer-form", () => ({ NewCustomerForm: () => <span>new-form</span> }));
vi.mock("../../components/error-banner", () => ({ ErrorBanner: ({ message }: { message: string }) => <span>err-{message}</span> }));
vi.mock("../../components/photo-zoom-viewer", () => ({ PhotoZoomViewer: ({ onClose }: { onClose: () => void }) => <button type="button" onClick={onClose}>close-viewer</button> }));

import NewCustomerScreen from "./new";

const form = (over: Record<string, unknown> = {}) =>
  ({ busy: false, error: null, onSubmit: vi.fn(), photo: { viewerUri: null, setViewerUri: vi.fn() }, ...over });

describe("NewCustomerScreen", () => {
  it("renders the form, saves, and navigates back", () => {
    (router.back as ReturnType<typeof vi.fn>).mockClear();
    const onSubmit = vi.fn();
    useNewCustomerForm.mockReturnValue(form({ onSubmit }));
    render(<NewCustomerScreen />);
    expect(screen.getByText("new-form")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Save customer"));
    expect(onSubmit).toHaveBeenCalled();
    fireEvent.click(screen.getByText("‹"));
    expect(router.back).toHaveBeenCalled();
  });

  it("shows the error banner, the busy spinner, and the photo viewer", () => {
    const setViewerUri = vi.fn();
    useNewCustomerForm.mockReturnValue(form({ busy: true, error: "Fix the form", photo: { viewerUri: "file://a", setViewerUri } }));
    render(<NewCustomerScreen />);
    expect(screen.getByText("err-Fix the form")).toBeInTheDocument();
    expect(screen.queryByText("Save customer")).not.toBeInTheDocument(); // busy → spinner
    fireEvent.click(screen.getByText("close-viewer"));
    expect(setViewerUri).toHaveBeenCalledWith(null);
  });
});
