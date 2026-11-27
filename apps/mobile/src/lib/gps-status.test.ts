import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isDayTracking, isPastSeCutoff } from "./gps-status";

const dayEndedToday = vi.fn<() => Promise<boolean>>();
const dayStartedToday = vi.fn<() => Promise<boolean>>();
const getForegroundWatch = vi.fn();
const istHour = vi.fn<() => number>();
let role: string | null = "SALES_EXECUTIVE";

vi.mock("./auth", () => ({ useAuth: { getState: () => ({ user: role ? { role } : null }) } }));
vi.mock("./day-flag", () => ({ istHour: () => istHour() }));
vi.mock("./gps-config", () => ({ SE_CUTOFF_HOUR: 20 }));
vi.mock("./gps-session", () => ({ dayEndedToday: () => dayEndedToday(), dayStartedToday: () => dayStartedToday() }));
vi.mock("./gps-state", () => ({ getForegroundWatch: () => getForegroundWatch() }));

beforeEach(() => {
  dayEndedToday.mockResolvedValue(false);
  dayStartedToday.mockResolvedValue(true);
  getForegroundWatch.mockReturnValue(null);
  istHour.mockReturnValue(10);
  role = "SALES_EXECUTIVE";
});
afterEach(() => vi.clearAllMocks());

describe("isDayTracking", () => {
  it("is false once the day has been ended", async () => {
    dayEndedToday.mockResolvedValue(true);
    expect(await isDayTracking()).toBe(false);
  });
  it("is true while a foreground watch is active", async () => {
    getForegroundWatch.mockReturnValue({ remove: () => {} });
    expect(await isDayTracking()).toBe(true);
  });
  it("is true when a day was committed today (durable flag is authoritative)", async () => {
    expect(await isDayTracking()).toBe(true);
  });
  it("is false when the day was not started today", async () => {
    dayStartedToday.mockResolvedValue(false);
    expect(await isDayTracking()).toBe(false);
  });
});

describe("isPastSeCutoff", () => {
  it("is true for an SE at/after 8 PM IST", () => {
    istHour.mockReturnValue(20);
    expect(isPastSeCutoff()).toBe(true);
    istHour.mockReturnValue(23);
    expect(isPastSeCutoff()).toBe(true);
  });
  it("is false for an SE before 8 PM IST", () => {
    istHour.mockReturnValue(19);
    expect(isPastSeCutoff()).toBe(false);
  });
  it("is false for a non-SE (Logistics) at any hour", () => {
    role = "LOGISTICS";
    istHour.mockReturnValue(23);
    expect(isPastSeCutoff()).toBe(false);
  });
  it("is false when no user is signed in", () => {
    role = null;
    istHour.mockReturnValue(23);
    expect(isPastSeCutoff()).toBe(false);
  });
});
