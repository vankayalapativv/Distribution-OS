import { beforeEach, describe, expect, test, vi } from "vitest";
import { authHeaders, authTestEnv, installAuthFetchMock } from "../test/auth";

const SE_ID = "00000000-0000-4000-8000-000000000004";
const MANAGER_ID = "00000000-0000-4000-8000-000000000002";
const CUSTOMER_1_ID = "00000000-0000-4000-8000-000000000501";
const CUSTOMER_2_ID = "00000000-0000-4000-8000-000000000502";
const BEAT_PLAN_ID = "00000000-0000-4000-8000-000000000601";

// Weekday the mocked "today" resolves to (1=Mon…6=Sat, 7=Sun). Mutable so a
// single test can exercise the Sunday = no-beat branch.
let mockWeekday = 2;

const sampleStop1 = {
  stopId: "00000000-0000-4000-8000-000000000701",
  sequenceNo: 1,
  stopStatus: "pending",
  customerId: CUSTOMER_1_ID,
  customerCode: "CUST-0001",
  legalName: "Raj Motors Pvt Ltd",
  contactPhone: "9876543210",
  address: new Date("2026-07-08T00:00:00.000Z"),
};

const sampleStop2 = {
  stopId: null,
  sequenceNo: 2,
  stopStatus: "pending",
  customerId: CUSTOMER_2_ID,
  customerCode: "CUST-0002",
  legalName: "Sri Auto Works",
  contactPhone: null,
  address: "45 Ring Road, Chennai",
};

vi.mock("@neondatabase/serverless", () => ({
  neon: () => async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join(" ");

    if (query.includes("auth_app_profile")) {
      const roleBySubject: Record<string, string> = {
        "neon-super-admin": "SUPER_ADMIN",
        "neon-manager": "MANAGER",
        "neon-se": "SALES_EXECUTIVE",
      };
      const userIdBySubject: Record<string, string> = {
        "neon-super-admin": "00000000-0000-4000-8000-000000000001",
        "neon-manager": MANAGER_ID,
        "neon-se": SE_ID,
      };
      const subject = values[0] as string;
      return [{ role: roleBySubject[subject], userId: userIdBySubject[subject] ?? SE_ID , enterpriseId: "00000000-0000-4000-8000-0000000000e1"}];
    }

    // IST weekday + date driving which template applies.
    if (query.includes("beat_today_ist")) {
      return [{ weekday: mockWeekday, istDate: new Date("2026-07-07T00:00:00.000Z") }];
    }
    // Materialize-on-read steps (upsert plan / add / prune return nothing).
    if (query.includes("today_beat_plan_id")) return [{ id: BEAT_PLAN_ID }];
    if (
      query.includes("upsert_today_beat_plan") ||
      query.includes("add_beat_stops_from_template") ||
      query.includes("prune_beat_stops_removed_from_template")
    ) {
      return [];
    }

    if (query.includes("get_beat_plan_stops")) {
      return values.includes(BEAT_PLAN_ID) ? [sampleStop1, sampleStop2] : [];
    }

    return [];
  },
}));

const env = { DATABASE_URL: "postgresql://example.test/db", ...authTestEnv };

function headers(subject: string) {
  return { "Content-Type": "application/json", ...authHeaders(subject) };
}

describe("beats routes", () => {
  beforeEach(() => {
    mockWeekday = 2; // Tuesday by default
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(installAuthFetchMock()));
  });

  describe("GET /beats/today", () => {
    test("Sales Executive gets today's materialized beat plan with stops", async () => {
      const { default: app } = await import("../index");
      const res = await app.request("/api/v1/beats/today", { headers: headers("neon-se") }, env);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: {
          beatPlanId: BEAT_PLAN_ID,
          planStatus: "planned",
          stops: [
            { sequenceNo: 1, legalName: "Raj Motors Pvt Ltd", stopStatus: "pending" },
            { sequenceNo: 2, legalName: "Sri Auto Works", stopStatus: "pending" },
          ],
        },
      });
    });

    test("Sunday has no beat — returns null plan and empty stops", async () => {
      mockWeekday = 7; // Sunday
      const { default: app } = await import("../index");
      const res = await app.request("/api/v1/beats/today", { headers: headers("neon-se") }, env);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({ success: true, data: { beatPlanId: null, stops: [] } });
    });

    test("Unauthenticated request returns 401", async () => {
      const { default: app } = await import("../index");
      const res = await app.request("/api/v1/beats/today", {}, env);
      expect(res.status).toBe(401);
    });
  });
});
