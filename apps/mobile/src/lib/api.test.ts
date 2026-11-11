import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { apiFetch } from "./api";
import { setAuthEventHandlers } from "./auth-events";
import { setTokenMinter } from "./token-refresh";

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/** A syntactically valid JWT whose payload carries the given `exp` (epoch s). */
function jwtWithExp(expSeconds: number): string {
  const payload = Buffer.from(JSON.stringify({ exp: expSeconds })).toString("base64url");
  return `h.${payload}.s`;
}

function bearerOf(call: unknown): string | undefined {
  const init = (call as [string, RequestInit])[1];
  return (init.headers as Record<string, string>).Authorization;
}

describe("apiFetch — session lifecycle side effects", () => {
  let onRefresh: ReturnType<typeof vi.fn>;
  let onExpired: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onRefresh = vi.fn();
    onExpired = vi.fn();
    setAuthEventHandlers({
      onRefresh: onRefresh as (token: string) => void,
      onExpired: onExpired as () => void,
    });
    // Space calls out past the notifyAuthExpired debounce window (3s).
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test("adopts an X-Refresh-Token from a successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, { success: true, data: { ok: 1 } }, { "X-Refresh-Token": "NEW.TOKEN" }),
      ),
    );
    await apiFetch("/anything", { token: "OLD.TOKEN" });
    expect(onRefresh).toHaveBeenCalledWith("NEW.TOKEN");
    expect(onExpired).not.toHaveBeenCalled();
  });

  test("fires auth-expired when a token-bearing request gets a 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(401, { success: false, error: { code: "UNAUTHORIZED", message: "dead" } }),
      ),
    );
    await expect(apiFetch("/anything", { token: "DEAD.TOKEN" })).rejects.toMatchObject({
      status: 401,
    });
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  test("does NOT fire auth-expired on a 401 with no token (a login attempt)", async () => {
    vi.setSystemTime(new Date("2030-01-01T00:00:00Z")); // clear the debounce window
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(401, {
          success: false,
          error: { code: "INVALID_CREDENTIALS", message: "wrong" },
        }),
      ),
    );
    await expect(
      apiFetch("/auth/login", { method: "POST", body: { email: "x", password: "y" } }),
    ).rejects.toMatchObject({ status: 401 });
    expect(onExpired).not.toHaveBeenCalled();
  });
});

describe("apiFetch — Neon token refresh", () => {
  afterEach(() => {
    setTokenMinter(async () => ({ status: "revoked" }));
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test("reactive: a 401 mints a fresh token and retries once, then succeeds", async () => {
    setTokenMinter(async () => ({ status: "active", token: "FRESH.TOKEN" }));
    const onExpired = vi.fn();
    setAuthEventHandlers({ onExpired: onExpired as () => void });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(401, { success: false, error: { code: "UNAUTHORIZED", message: "dead" } }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { success: true, data: { ok: 1 } }));
    vi.stubGlobal("fetch", fetchMock);

    const data = await apiFetch<{ ok: number }>("/anything", { token: jwtWithExp(4102444800) });

    expect(data).toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(bearerOf(fetchMock.mock.calls[1])).toBe("Bearer FRESH.TOKEN");
    expect(onExpired).not.toHaveBeenCalled();
  });

  test("reactive: a 401 that the refresh cannot recover soft-expires the session", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2031-01-01T00:00:00Z")); // clear the notifyAuthExpired debounce
    setTokenMinter(async () => ({ status: "revoked" })); // no session / revoked
    const onExpired = vi.fn();
    setAuthEventHandlers({ onExpired: onExpired as () => void });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(401, { success: false, error: { code: "UNAUTHORIZED", message: "dead" } }),
      ),
    );

    await expect(apiFetch("/anything", { token: jwtWithExp(4102444800) })).rejects.toMatchObject({
      status: 401,
    });
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  test("a 401 whose refresh is UNAVAILABLE (offline) does NOT log the user out", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2032-01-01T00:00:00Z")); // clear the debounce window
    // Couldn't reach Neon to refresh — a weak-signal field rep, NOT a dead session.
    setTokenMinter(async () => ({ status: "unavailable" }));
    const onExpired = vi.fn();
    setAuthEventHandlers({ onExpired: onExpired as () => void });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(401, { success: false, error: { code: "UNAUTHORIZED", message: "dead" } }),
      ),
    );

    // Fails soft with an OFFLINE error instead of a 401 — and crucially keeps
    // the session (never fires auth-expired).
    await expect(apiFetch("/anything", { token: jwtWithExp(4102444800) })).rejects.toMatchObject({
      code: "OFFLINE",
    });
    expect(onExpired).not.toHaveBeenCalled();
  });

  test("proactive: a near-expiry token is swapped before the request is sent", async () => {
    setTokenMinter(async () => ({ status: "active", token: "FRESH.TOKEN" }));
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { success: true, data: { ok: 1 } }));
    vi.stubGlobal("fetch", fetchMock);

    const nearExpiry = jwtWithExp(Math.floor(Date.now() / 1000) + 30); // 30s left
    await apiFetch("/anything", { token: nearExpiry });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(bearerOf(fetchMock.mock.calls[0])).toBe("Bearer FRESH.TOKEN");
  });
});
