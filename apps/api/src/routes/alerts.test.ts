import { beforeEach, describe, expect, test, vi } from "vitest";
import { authHeaders, authTestEnv, installAuthFetchMock } from "../test/auth";

const SUPER_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const MANAGER_ID = "00000000-0000-4000-8000-000000000002";
const ACCOUNTANT_ID = "00000000-0000-4000-8000-000000000003";
const SE_ID = "00000000-0000-4000-8000-000000000004";
const ALERT_ID = "00000000-0000-4000-8000-000000000901";

const sampleAlert = {
  id: ALERT_ID,
  alertDate: "2026-07-08",
  alertType: "COLLECTION_REJECTED",
  severity: "medium",
  customerId: null,
  customerName: null,
  executiveId: SE_ID,
  executiveName: "Arjun SE",
  alertMessage: "Collection COLL-0001 was rejected: Cheque bounced",
  recommendedAction: "Review and re-submit the collection with correct details",
  status: "open",
  closedAt: null,
  createdAt: "2026-07-08T10:00:00.000Z",
};

vi.mock("@neondatabase/serverless", () => ({
  neon: () => async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join(" ");

    if (query.includes("auth_app_profile")) {
      const roleBySubject: Record<string, string> = {
        "neon-super-admin": "SUPER_ADMIN",
        "neon-manager": "MANAGER",
        "neon-accountant": "ACCOUNTANT",
      };
      const userIdBySubject: Record<string, string> = {
        "neon-super-admin": SUPER_ADMIN_ID,
        "neon-manager": MANAGER_ID,
        "neon-accountant": ACCOUNTANT_ID,
      };
      const subject = values[0] as string;
      return [
        {
          role: roleBySubject[subject],
          userId: userIdBySubject[subject] ?? SUPER_ADMIN_ID,
        },
      ];
    }

    if (query.includes("list_alerts")) {
      return [sampleAlert];
    }

    if (query.includes("get_alert_by_id")) {
      return values.includes(ALERT_ID) ? [sampleAlert] : [];
    }

    if (query.includes("close_alert")) {
      return [{ ...sampleAlert, status: "closed", closedAt: "2026-07-08T11:00:00.000Z" }];
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

describe("alerts routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(installAuthFetchMock()),
    );
  });

  // ── GET /alerts ─────────────────────────────────────────────────────────────

  describe("GET /alerts", () => {
    test("Super Admin can list alerts", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/alerts",
        { headers: headers("neon-super-admin") },
        env,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: [{ alertType: "COLLECTION_REJECTED", severity: "medium", status: "open" }],
      });
    });

    test("Manager can list alerts", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/alerts",
        { headers: headers("neon-manager") },
        env,
      );

      expect(res.status).toBe(200);
    });

    test("Accountant cannot list alerts", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/alerts",
        { headers: headers("neon-accountant") },
        env,
      );

      expect(res.status).toBe(403);
    });

    test("Unauthenticated request returns 401", async () => {
      const { default: app } = await import("../index");

      const res = await app.request("/api/v1/alerts", {}, env);

      expect(res.status).toBe(401);
    });
  });

  // ── POST /alerts/:id/close ──────────────────────────────────────────────────

  describe("POST /alerts/:id/close", () => {
    test("Super Admin can close an alert", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/alerts/${ALERT_ID}/close`,
        {
          method: "POST",
          headers: headers("neon-super-admin"),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: { status: "closed" },
      });
    });

    test("Manager can close an alert", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/alerts/${ALERT_ID}/close`,
        {
          method: "POST",
          headers: headers("neon-manager"),
        },
        env,
      );

      expect(res.status).toBe(200);
    });

    test("Accountant cannot close an alert", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/alerts/${ALERT_ID}/close`,
        {
          method: "POST",
          headers: headers("neon-accountant"),
        },
        env,
      );

      expect(res.status).toBe(403);
    });

    test("Returns 404 when alert not found", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/alerts/00000000-0000-4000-8000-000000000000/close`,
        {
          method: "POST",
          headers: headers("neon-super-admin"),
        },
        env,
      );

      expect(res.status).toBe(404);
    });
  });
});
