import { vi } from "vitest";

/** Shared fixtures for the UserSessionsSection tests (split across two files). */
export type Session = {
  id: string;
  createdAt: string | null;
  expiresAt: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  current?: boolean;
};

export const sess = (over: Partial<Session> = {}): Session => ({
  id: "s1", createdAt: "2026-11-20T10:00:00Z", expiresAt: null,
  ipAddress: "1.2.3.4", userAgent: "node", current: false, ...over,
});

/** Mock fetch: GET returns `list`, DELETE returns `del`. */
export function mockSessionsFetch(
  list: { ok?: boolean; body: unknown },
  del: { ok?: boolean; body: unknown } = { body: { ok: true } },
) {
  return vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
    const r = (init as RequestInit | undefined)?.method === "DELETE" ? del : list;
    return Promise.resolve(new Response(JSON.stringify(r.body), { status: r.ok === false ? 500 : 200 }));
  });
}
