import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildLines, imageSize, reverseGeocode } from "./photo-stamp-band";

const getSize = vi.fn();
const fetchMock = vi.fn();
let token: string | null = "tok";
vi.mock("react-native", () => ({ Image: { getSize: (...a: unknown[]) => getSize(...a) } }));
vi.mock("./api", () => ({ API_BASE_URL: "http://api" }));
vi.mock("./auth", () => ({ useAuth: { getState: () => ({ token }) } }));

beforeEach(() => { token = "tok"; vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("reverseGeocode", () => {
  it("returns the resolved address with a bearer header", async () => {
    fetchMock.mockResolvedValue({ json: () => Promise.resolve({ data: { address: "MG Road, Hyderabad" } }) });
    expect(await reverseGeocode(17.4, 78.5)).toBe("MG Road, Hyderabad");
    const opts = fetchMock.mock.calls[0][1] as { headers: Record<string, string> };
    expect(opts.headers.Authorization).toBe("Bearer tok");
  });
  it("omits the auth header when signed out and tolerates a null body", async () => {
    token = null;
    fetchMock.mockResolvedValue({ json: () => Promise.reject(new Error("not json")) });
    expect(await reverseGeocode(1, 2)).toBeNull();
    const opts = fetchMock.mock.calls[0][1] as { headers: Record<string, string> };
    expect(opts.headers.Authorization).toBeUndefined();
  });
  it("returns null when the request fails", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    expect(await reverseGeocode(1, 2)).toBeNull();
  });
  it("aborts and returns null after the 3.5s timeout", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url: string, opts: { signal: AbortSignal }) =>
      new Promise((_res, rej) => { opts.signal.addEventListener("abort", () => rej(new Error("aborted"))); }),
    );
    const p = reverseGeocode(1, 2);
    await vi.advanceTimersByTimeAsync(3500);
    expect(await p).toBeNull();
  });
});

describe("imageSize", () => {
  it("resolves the natural size on success", async () => {
    getSize.mockImplementation((_uri: string, ok: (w: number, h: number) => void) => ok(800, 600));
    expect(await imageSize("file://a.jpg")).toEqual({ w: 800, h: 600 });
  });
  it("resolves {0,0} on error", async () => {
    getSize.mockImplementation((_uri: string, _ok: unknown, err: () => void) => err());
    expect(await imageSize("file://a.jpg")).toEqual({ w: 0, h: 0 });
  });
});

describe("buildLines", () => {
  const ctx = { userName: "Ravi", customerName: "Balaji Motors" };
  it("titles with the customer, adds a distinct address + coords", () => {
    const lines = buildLines({ latitude: 17.4, longitude: 78.5 }, "MG Road", ctx);
    expect(lines[0]).toBe("📍 Balaji Motors");
    expect(lines).toContain("MG Road");
    expect(lines).toContain("17.40000, 78.50000");
  });
  it("falls back to the address, then the brand, as the title", () => {
    expect(buildLines(null, "MG Road", { userName: "R" })[0]).toBe("📍 MG Road");
    expect(buildLines(null, null, { userName: "R" })[0]).toBe("📍 Distribution OS Automobile");
  });
  it("does not repeat the address when it is already the title", () => {
    const lines = buildLines({ latitude: 1, longitude: 2 }, "MG Road", { userName: "R", customerName: null });
    expect(lines.filter((l) => l === "MG Road")).toHaveLength(0); // address is the title, not repeated
    expect(lines[0]).toBe("📍 MG Road");
  });
  it("shows 'Location unavailable' without a fix", () => {
    expect(buildLines(null, null, { userName: "R" })).toContain("Location unavailable");
  });
  it("formats a morning IST time (AM)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-27T03:30:00Z")); // 09:00 IST
    expect(buildLines(null, null, { userName: "Ravi" }).at(-1)).toMatch(/· 9:00 AM · Ravi$/);
  });
  it("formats noon IST (12 PM)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-27T06:30:00Z")); // 12:00 IST
    expect(buildLines(null, null, { userName: "Ravi" }).at(-1)).toMatch(/· 12:00 PM ·/);
  });
  it("formats midnight IST (12 AM)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-27T18:30:00Z")); // 00:00 IST next day
    expect(buildLines(null, null, { userName: "Ravi" }).at(-1)).toMatch(/· 12:00 AM ·/);
  });
});
