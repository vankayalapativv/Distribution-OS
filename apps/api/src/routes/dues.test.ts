import { beforeEach, describe, expect, test, vi } from "vitest";
import { authHeaders, authTestEnv, installAuthFetchMock } from "../test/auth";

const SUPER_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const SE_ID = "00000000-0000-4000-8000-000000000004";
const CUSTOMER_ID = "00000000-0000-4000-8000-000000000777";

vi.mock("@neondatabase/serverless", () => ({
  neon: () => async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join(" ");

    if (query.includes("auth_app_profile")) {
      const roleBySubject: Record<string, string> = {
        "neon-super-admin": "SUPER_ADMIN",
        "neon-se": "SALES_EXECUTIVE",
      };
      const userIdBySubject: Record<string, string> = {
        "neon-super-admin": SUPER_ADMIN_ID,
        "neon-se": SE_ID,
      };
      const subject = values[0] as string;
      return [
        {
          role: roleBySubject[subject],
          userId: userIdBySubject[subject] ?? SE_ID, enterpriseId: "00000000-0000-4000-8000-0000000000e1",
        },
      ];
    }

    if (query.includes("dues_summary_for_se")) {
      if (values.includes(SE_ID)) {
        return [
          { bucket: 0, customers: 2, outstanding: "12000" },
          { bucket: 3, customers: 1, outstanding: "5836.00" },
        ];
      }
      return [];
    }

    if (query.includes("dues_customers_for_se")) {
      // bucket index 3 (60_plus) is the second bound param
      if (values.includes(SE_ID) && values.includes(3)) {
        return [
          {
            customerId: CUSTOMER_ID,
            customerName: "Janatha Automobiles",
            // Date object: exercises the instanceof Date branch
            oldestInvoiceDate: new Date("2026-05-01T00:00:00.000Z"),
            ageDays: 84,
            outstanding: "5836.00",
          },
        ];
      }
      return [];
    }

    return [];
  },
}));

const env = {
  DATABASE_URL: "postgresql://example.test/db",
  ...authTestEnv,
};

function headers(subject: string) {
  return {
    "Content-Type": "application/json",
    ...authHeaders(subject),
  };
}

describe("dues routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(installAuthFetchMock()),
    );
  });

  describe("GET /dues/me/summary", () => {
    test("SE gets all four buckets with counts filled in", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/dues/me/summary",
        { headers: headers("neon-se") },
        env,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.buckets).toEqual([
        { key: "0_30", label: "0–30 days", customers: 2, outstanding: 12000 },
        { key: "30_45", label: "31–45 days", customers: 0, outstanding: 0 },
        { key: "45_60", label: "46–60 days", customers: 0, outstanding: 0 },
        { key: "60_plus", label: "61+ days", customers: 1, outstanding: 5836 },
      ]);
      expect(body.data.totalCustomers).toBe(3);
      expect(body.data.totalOutstanding).toBe(17836);
    });

    test("office roles are rejected", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/dues/me/summary",
        { headers: headers("neon-super-admin") },
        env,
      );

      expect(res.status).toBe(403);
    });
  });

  describe("GET /dues/me/customers", () => {
    test("SE drills into a bucket and gets its customers", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/dues/me/customers?bucket=60_plus",
        { headers: headers("neon-se") },
        env,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.bucket).toBe("60_plus");
      expect(body.data.customers).toEqual([
        {
          customerId: CUSTOMER_ID,
          customerName: "Janatha Automobiles",
          oldestInvoiceDate: "2026-05-01",
          ageDays: 84,
          outstanding: 5836,
        },
      ]);
    });

    test("unknown bucket is a 422", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/dues/me/customers?bucket=whatever",
        { headers: headers("neon-se") },
        env,
      );

      expect(res.status).toBe(422);
    });
  });
});
