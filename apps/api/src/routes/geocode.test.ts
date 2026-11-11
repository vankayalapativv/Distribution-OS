import { beforeEach, describe, expect, test, vi } from "vitest";
import { authHeaders, authTestEnv, installAuthFetchMock } from "../test/auth";

const SE_ID = "00000000-0000-4000-8000-000000000004";

// Minimal neon mock: resolve the auth subject → SALES_EXECUTIVE role.
vi.mock("@neondatabase/serverless", () => ({
  neon: () => async (strings: TemplateStringsArray) => {
    const query = strings.join(" ");
    if (query.includes("auth_app_profile")) {
      return [{ role: "SALES_EXECUTIVE", userId: SE_ID }];
    }
    return [];
  },
}));

const baseEnv = { DATABASE_URL: "postgresql://example.test/db", ...authTestEnv };

function headers(subject: string) {
  return { "Content-Type": "application/json", ...authHeaders(subject) };
}

/** fetch mock: JWKS for auth, chosen responses for Google + Nominatim. */
function mockFetch(
  googleResponder?: (url: string) => Response,
  nominatimResponder?: (url: string) => Response,
) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("maps.googleapis.com")) {
      return googleResponder ? googleResponder(url) : Response.json({ status: "ZERO_RESULTS", results: [] });
    }
    if (url.includes("nominatim.openstreetmap.org")) {
      return nominatimResponder ? nominatimResponder(url) : Response.json({});
    }
    return Response.json(installAuthFetchMock());
  });
}

describe("POST /geocode/reverse", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("rejects non-numeric lat/lng", async () => {
    mockFetch();
    const { default: app } = await import("../index");
    const res = await app.request(
      "/api/v1/geocode/reverse",
      { method: "POST", headers: headers("neon-se"), body: JSON.stringify({ lat: "x", lng: 1 }) },
      baseEnv,
    );
    expect(res.status).toBe(422);
  });

  test("no key → falls back to OpenStreetMap Nominatim", async () => {
    mockFetch(undefined, () =>
      Response.json({ display_name: "Kondapur, Serilingampalle, Hyderabad, Telangana, India" }),
    );
    const { default: app } = await import("../index");
    const res = await app.request(
      "/api/v1/geocode/reverse",
      { method: "POST", headers: headers("neon-se"), body: JSON.stringify({ lat: 17.42, lng: 78.47 }) },
      baseEnv, // no GOOGLE_GEOCODING_API_KEY
    );
    expect(res.status).toBe(200);
    // ", India" is trimmed off the tail for a tidier stamp.
    expect((await res.json()).data).toEqual({
      address: "Kondapur, Serilingampalle, Hyderabad, Telangana",
    });
  });

  test("no key + OSM also fails → address null (coords-only)", async () => {
    mockFetch(undefined, () => new Response("nope", { status: 500 }));
    const { default: app } = await import("../index");
    const res = await app.request(
      "/api/v1/geocode/reverse",
      { method: "POST", headers: headers("neon-se"), body: JSON.stringify({ lat: 17.42, lng: 78.47 }) },
      baseEnv,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ address: null });
  });

  test("with key + Google OK → formatted_address", async () => {
    mockFetch(() =>
      Response.json({ status: "OK", results: [{ formatted_address: "12-3-45 Main Rd, Hyderabad" }] }),
    );
    const { default: app } = await import("../index");
    const res = await app.request(
      "/api/v1/geocode/reverse",
      { method: "POST", headers: headers("neon-se"), body: JSON.stringify({ lat: 17.42, lng: 78.47 }) },
      { ...baseEnv, GOOGLE_GEOCODING_API_KEY: "test-key" },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ address: "12-3-45 Main Rd, Hyderabad" });
  });

  test("Google returns no result → falls back to OpenStreetMap", async () => {
    mockFetch(
      () => Response.json({ status: "ZERO_RESULTS", results: [] }),
      () => Response.json({ display_name: "MG Road, Secunderabad, Telangana, India" }),
    );
    const { default: app } = await import("../index");
    const res = await app.request(
      "/api/v1/geocode/reverse",
      { method: "POST", headers: headers("neon-se"), body: JSON.stringify({ lat: 17.44, lng: 78.5 }) },
      { ...baseEnv, GOOGLE_GEOCODING_API_KEY: "test-key" },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ address: "MG Road, Secunderabad, Telangana" });
  });
});
