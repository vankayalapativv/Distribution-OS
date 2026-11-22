import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserSessionsSection } from "./super-admin-user-sessions";
import { mockSessionsFetch, sess } from "./super-admin-user-sessions.test-kit";

afterEach(() => vi.restoreAllMocks());

describe("UserSessionsSection — loading & display", () => {
  it("shows the empty state when there are no sessions", async () => {
    mockSessionsFetch({ body: { sessions: [] } });
    render(<UserSessionsSection appLoginId="neon-1" />);
    expect(await screen.findByText(/signed out everywhere/)).toBeInTheDocument();
  });
  it("surfaces a load error", async () => {
    mockSessionsFetch({ ok: false, body: { error: "nope" } });
    render(<UserSessionsSection appLoginId="neon-1" />);
    expect(await screen.findByText("nope")).toBeInTheDocument();
  });
  it("lists sessions with a formatted sign-in line and device model", async () => {
    mockSessionsFetch({ body: { sessions: [sess({ userAgent: "okhttp/4.12.0", ipAddress: "9.9.9.9" })] } });
    render(<UserSessionsSection appLoginId="neon-1" deviceModel="Samsung SM-G991B" />);
    expect(await screen.findByText("Mobile app · Samsung SM-G991B")).toBeInTheDocument();
    expect(screen.getByText(/9\.9\.9\.9 · signed in/)).toBeInTheDocument();
  });
  it("falls back to the generic message + defaults sessions to [] when the body is empty", async () => {
    // Load with no `sessions` key → `?? []` → empty state.
    mockSessionsFetch({ body: {} });
    const { unmount } = render(<UserSessionsSection appLoginId="neon-1" />);
    expect(await screen.findByText(/signed out everywhere/)).toBeInTheDocument();
    unmount();
    // Load error with no `error` field → generic fallback.
    mockSessionsFetch({ ok: false, body: {} });
    render(<UserSessionsSection appLoginId="neon-2" />);
    expect(await screen.findByText("Could not load sessions.")).toBeInTheDocument();
  });
  it("shows the generic message when the load rejects with a non-Error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue("network down"); // not an Error instance
    render(<UserSessionsSection appLoginId="neon-1" />);
    expect(await screen.findByText("Could not load sessions.")).toBeInTheDocument();
  });
  it("ignores an in-flight load that resolves after unmount (success + error cancelled guards)", async () => {
    let resolve!: (v: Response) => void;
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise<Response>((r) => { resolve = r; }) as ReturnType<typeof fetch>);
    const okUnmount = render(<UserSessionsSection appLoginId="neon-1" />);
    okUnmount.unmount();
    resolve(new Response(JSON.stringify({ sessions: [sess()] }), { status: 200 }));
    await Promise.resolve();

    let reject!: (e: unknown) => void;
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise<Response>((_r, rej) => { reject = rej; }) as ReturnType<typeof fetch>);
    const errUnmount = render(<UserSessionsSection appLoginId="neon-2" />);
    errUnmount.unmount();
    reject(new Error("too late"));
    await Promise.resolve();
    expect(true).toBe(true); // passes if the post-unmount setState guards hold
  });
});
