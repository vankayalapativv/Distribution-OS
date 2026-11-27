import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { router } from "expo-router";

const form = vi.fn();
vi.mock("../../../lib/use-advance-request", () => ({ useAdvanceRequest: () => form() }));
vi.mock("expo-router", () => ({ router: { back: vi.fn() } }));
vi.mock("../../../components/error-banner", () => ({ ErrorBanner: ({ message }: { message: string }) => <span>err:{message}</span> }));

import RequestAdvanceScreen from "./advance";

const base = {
  amount: "", setAmount: vi.fn(), reason: "", setReason: vi.fn(),
  error: null as string | null, busy: false, submit: vi.fn(),
};
beforeEach(() => { vi.clearAllMocks(); form.mockReturnValue({ ...base }); });

describe("RequestAdvanceScreen", () => {
  it("types amount + reason and sends", () => {
    render(<RequestAdvanceScreen />);
    expect(screen.getByText("Request an advance")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("₹ 0"), { target: { value: "10000" } });
    expect(base.setAmount).toHaveBeenCalledWith("10000");
    fireEvent.change(screen.getByPlaceholderText("e.g. medical emergency"), { target: { value: "x" } });
    expect(base.setReason).toHaveBeenCalledWith("x");
    fireEvent.click(screen.getByText("Send request"));
    expect(base.submit).toHaveBeenCalled();
  });

  it("shows a spinner while busy + surfaces errors, and goes back", () => {
    form.mockReturnValue({ ...base, busy: true, error: "offline" });
    render(<RequestAdvanceScreen />);
    expect(screen.queryByText("Send request")).not.toBeInTheDocument();
    expect(screen.getByText("err:offline")).toBeInTheDocument();
    fireEvent.click(screen.getByText("‹"));
    expect(router.back).toHaveBeenCalled();
  });
});
