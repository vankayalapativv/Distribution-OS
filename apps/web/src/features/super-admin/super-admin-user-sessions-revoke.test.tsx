import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserSessionsSection } from "./super-admin-user-sessions";
import { mockSessionsFetch, sess } from "./super-admin-user-sessions.test-kit";

afterEach(() => vi.restoreAllMocks());

describe("UserSessionsSection — revoke", () => {
  it("signs out a single (non-current) session and removes it", async () => {
    mockSessionsFetch({ body: { sessions: [sess({ id: "s1" }), sess({ id: "s2", ipAddress: null, createdAt: null })] } });
    render(<UserSessionsSection appLoginId="neon-1" />);
    const buttons = await screen.findAllByRole("button", { name: "Sign out" });
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Sign out" })).toHaveLength(1));
  });
  it("redirects to logout when the revoked session is the admin's own", async () => {
    mockSessionsFetch({ body: { sessions: [sess({ id: "s1", current: true })] } });
    const loc = { href: "" };
    Object.defineProperty(window, "location", { value: loc, writable: true });
    render(<UserSessionsSection appLoginId="neon-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(loc.href).toBe("/api/auth/logout"));
  });
  it("signs out all sessions", async () => {
    mockSessionsFetch({ body: { sessions: [sess({ id: "s1" }), sess({ id: "s2" })] } });
    render(<UserSessionsSection appLoginId="neon-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Sign out all" }));
    await waitFor(() => expect(screen.getByText(/signed out everywhere/)).toBeInTheDocument());
  });
  it("surfaces a revoke error", async () => {
    mockSessionsFetch({ body: { sessions: [sess({ id: "s1" })] } }, { ok: false, body: { error: "revoke failed" } });
    render(<UserSessionsSection appLoginId="neon-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    expect(await screen.findByText("revoke failed")).toBeInTheDocument();
  });
  it("falls back to a generic revoke message when the error body is empty", async () => {
    mockSessionsFetch({ body: { sessions: [sess({ id: "s1" })] } }, { ok: false, body: {} });
    render(<UserSessionsSection appLoginId="neon-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    expect(await screen.findByText("Could not sign out.")).toBeInTheDocument();
  });
  it("shows the generic message when a revoke rejects with a non-Error", async () => {
    mockSessionsFetch({ body: { sessions: [sess({ id: "s1" })] } });
    render(<UserSessionsSection appLoginId="neon-1" />);
    const btn = await screen.findByRole("button", { name: "Sign out" });
    vi.spyOn(globalThis, "fetch").mockRejectedValue("boom"); // DELETE rejects, non-Error
    fireEvent.click(btn);
    expect(await screen.findByText("Could not sign out.")).toBeInTheDocument();
  });
});
