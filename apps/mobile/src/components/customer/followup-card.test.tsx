import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const getLocalDb = vi.fn(() => ({}) as never);
const getOpenFollowup = vi.fn<(...a: unknown[]) => unknown>();
const resolveFollowupLocal = vi.fn<(...a: unknown[]) => unknown>();
const apiFetch = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve({}));

vi.mock("../../lib/db", () => ({ getLocalDb: () => getLocalDb() }));
vi.mock("../../lib/customer/followups", () => ({
  getOpenFollowup: (...a: unknown[]) => getOpenFollowup(...a),
  resolveFollowupLocal: (...a: unknown[]) => resolveFollowupLocal(...a),
}));
vi.mock("../../lib/api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));

import { FollowupCard } from "./followup-card";

afterEach(() => {
  getOpenFollowup.mockReset();
  resolveFollowupLocal.mockReset();
  apiFetch.mockClear();
  getLocalDb.mockReturnValue({} as never);
});

describe("FollowupCard", () => {
  it("renders nothing when there is no open follow-up", () => {
    getOpenFollowup.mockReturnValue(null);
    const { container } = render(<FollowupCard customerId="c1" token="t" />);
    expect(container.textContent).toBe("");
  });

  it("renders the follow-up with its time and resolves on Mark done", () => {
    getOpenFollowup.mockReturnValue({ reason: "Pay next week", followUpAt: "2026-11-27T10:00:00Z" });
    render(<FollowupCard customerId="c1" token="t" />);
    expect(screen.getByText(/Pay next week/)).toBeInTheDocument();
    expect(screen.getByText("Pending follow-up")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Mark done"));
    expect(resolveFollowupLocal).toHaveBeenCalled();
    expect(apiFetch).toHaveBeenCalledWith("/followups/customers/c1/resolve", { method: "POST", token: "t" });
  });

  it("renders a follow-up with no reminder time", () => {
    getOpenFollowup.mockReturnValue({ reason: "Call back", followUpAt: null });
    render(<FollowupCard customerId="c2" token={null} />);
    expect(screen.getByText(/Call back/)).toBeInTheDocument();
  });

  it("handles a missing local db (no row, still resolves server)", () => {
    getLocalDb.mockReturnValue(null as never);
    getOpenFollowup.mockReturnValue(null);
    const { container } = render(<FollowupCard customerId="c3" token="t" />);
    expect(container.textContent).toBe("");
  });

  it("marks done (swallowing a server error) even when the db is gone", async () => {
    getOpenFollowup.mockReturnValue({ reason: "Soon", followUpAt: null });
    apiFetch.mockReturnValueOnce(Promise.reject(new Error("net"))); // server resolve fails → swallowed
    render(<FollowupCard customerId="c4" token="t" />);
    getLocalDb.mockReturnValue(null as never); // db vanished before Mark done
    fireEvent.click(screen.getByText("Mark done"));
    expect(resolveFollowupLocal).not.toHaveBeenCalled();
    expect(apiFetch).toHaveBeenCalled();
    await Promise.resolve();
  });
});
