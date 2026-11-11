import { afterEach, describe, expect, test, vi } from "vitest";
import { neonProbeSession, neonSignIn } from "./neon-auth";

// expo-device / expo-constants pull in React Native; mock them so this stays a
// pure-Node unit test (and to assert the device string sign-in sends). vitest
// hoists vi.mock above the imports, so the mocks apply before ./neon-auth loads.
vi.mock("expo-device", () => ({ manufacturer: "samsung", modelName: "SM-G991B", osVersion: "13" }));
vi.mock("expo-constants", () => ({ default: { expoConfig: { version: "1.1.2" } } }));

/** The API `/auth/token` envelope: { success, data: { status, token? } }. */
function envelope(status: number, data: unknown, success = true): Response {
  return new Response(JSON.stringify({ success, data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("neonProbeSession — classifies the /auth/token response", () => {
  afterEach(() => vi.restoreAllMocks());

  test("active + token → active (returns the fresh token)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(envelope(200, { status: "active", token: "FRESH.JWT" })),
    );
    expect(await neonProbeSession("s")).toEqual({ status: "active", token: "FRESH.JWT" });
  });

  test("revoked → revoked (definitive: log the user out)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(envelope(200, { status: "revoked" })));
    expect(await neonProbeSession("s")).toEqual({ status: "revoked", token: null });
  });

  test("unavailable → unavailable (inconclusive: keep signed in)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(envelope(200, { status: "unavailable" })));
    expect(await neonProbeSession("s")).toEqual({ status: "unavailable", token: null });
  });

  test("non-OK HTTP (500) → unavailable (do NOT log out)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(envelope(500, null, false)));
    expect(await neonProbeSession("s")).toEqual({ status: "unavailable", token: null });
  });

  test("network error → unavailable (offline field worker stays signed in)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network request failed")));
    expect(await neonProbeSession("s")).toEqual({ status: "unavailable", token: null });
  });

  test("active status but no token → unavailable (not a revocation)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(envelope(200, { status: "active" })));
    expect(await neonProbeSession("s")).toEqual({ status: "unavailable", token: null });
  });
});

describe("neonSignIn — sends the identifier + device descriptor for session labelling", () => {
  afterEach(() => vi.restoreAllMocks());

  test("posts the identifier (email or phone), password and a device user-agent string", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      envelope(200, { session: "sess-1", token: "JWT", user: { id: "u1", name: "Asha", email: "a@b.c" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    // The app sends whatever the user typed (here a phone) as `identifier`; the
    // API resolves it to the account email server-side.
    const out = await neonSignIn("9985294475", "pw");
    expect(out).toEqual({ session: "sess-1", user: { id: "u1", name: "Asha", email: "a@b.c" } });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.identifier).toBe("9985294475");
    expect(body.email).toBeUndefined();
    expect(body.password).toBe("pw");
    expect(body.device).toBe("SriAparajita/1.1.2 (Android 13; samsung; SM-G991B)");
  });
});
