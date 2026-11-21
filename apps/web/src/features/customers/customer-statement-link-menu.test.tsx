import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiRequest = vi.fn();
vi.mock("@/lib/api-client", () => ({
  apiRequest: (...a: unknown[]) => apiRequest(...a),
  errorMessage: (e: unknown, fb: string) => (e instanceof Error ? e.message : fb),
}));

import { CustomerStatementLinkMenu } from "./customer-statement-link-menu";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const openMenu = () => fireEvent.click(screen.getByLabelText("More actions"));
const clickCopy = () => fireEvent.click(screen.getByText("Copy ledger link"));
const setClipboard = (writeText: () => Promise<void>) => Object.assign(navigator, { clipboard: { writeText } });

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("CustomerStatementLinkMenu", () => {
  it("mints the token, copies the link, shows Copied ✓, then clears it", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);
    apiRequest.mockResolvedValue({ token: "abc" });
    render(<CustomerStatementLinkMenu customerId="c1" actionConfig={cfg} />);
    openMenu();
    await act(async () => { clickCopy(); });
    expect(screen.getByText("Copied ✓")).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("/statement/abc"));
    expect(screen.getByText(/\/statement\/abc/)).toBeInTheDocument(); // link shown
    await act(async () => { vi.advanceTimersByTime(2500); }); // the copied flag clears
    expect(screen.queryByText("Copied ✓")).not.toBeInTheDocument();
  });

  it("shows a busy indicator while the token is minting", async () => {
    let resolve!: (v: { token: string }) => void;
    apiRequest.mockReturnValue(new Promise((r) => { resolve = r; }));
    setClipboard(vi.fn().mockResolvedValue(undefined));
    render(<CustomerStatementLinkMenu customerId="c1" actionConfig={cfg} />);
    openMenu();
    clickCopy();
    expect(await screen.findByText("…")).toBeInTheDocument(); // busy branch
    await act(async () => { resolve({ token: "x" }); });
  });

  it("hints manual copy when the clipboard is blocked", async () => {
    apiRequest.mockResolvedValue({ token: "abc" });
    setClipboard(vi.fn().mockRejectedValue(new Error("blocked")));
    render(<CustomerStatementLinkMenu customerId="c1" actionConfig={cfg} />);
    openMenu();
    clickCopy();
    await waitFor(() => expect(screen.getByText(/select the link below/)).toBeInTheDocument());
  });

  it("surfaces an error when minting fails", async () => {
    apiRequest.mockRejectedValue(new Error("boom"));
    render(<CustomerStatementLinkMenu customerId="c1" actionConfig={cfg} />);
    openMenu();
    clickCopy();
    await waitFor(() => expect(screen.getByText("boom")).toBeInTheDocument());
  });
});
