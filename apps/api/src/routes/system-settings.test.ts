import { beforeEach, describe, expect, test, vi } from "vitest";
import { authHeaders, authTestEnv, installAuthFetchMock } from "../test/auth";

const SUPER_ADMIN_ID = "00000000-0000-4000-8000-000000000001";

// Captures the last company upsert so tests can assert what was written.
let lastCompanyUpsert: { keys: unknown; values: unknown } | null = null;
let lastCreditUpsert: unknown = null;

vi.mock("@neondatabase/serverless", () => ({
  neon: () => async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join(" ");

    if (query.includes("auth_app_profile")) {
      const roleBySubject: Record<string, string> = {
        "neon-super-admin": "SUPER_ADMIN",
        "neon-manager": "MANAGER",
      };
      return [{ role: roleBySubject[values[0] as string], userId: SUPER_ADMIN_ID , enterpriseId: "00000000-0000-4000-8000-0000000000e1"}];
    }

    if (query.includes("system_settings_list")) {
      return [
        { key: "credit_overdue_days", value: "45" },
        { key: "company_legal_name", value: "Distribution OS" },
        { key: "company_gstin", value: "36ABCDE1234F1Z5" },
      ];
    }

    if (query.includes("upsert_company_profile")) {
      lastCompanyUpsert = { keys: values[0], values: values[1] };
      return [];
    }

    if (query.includes("upsert_credit_overdue_days")) {
      lastCreditUpsert = values[0];
      return [];
    }

    if (query.includes("insert_audit_log")) {
      return [];
    }

    return [];
  },
}));

const env = { DATABASE_URL: "postgresql://example.test/db", ...authTestEnv };

function headers(subject: string) {
  return { "Content-Type": "application/json", ...authHeaders(subject) };
}

describe("system-settings routes", () => {
  beforeEach(() => {
    vi.resetModules();
    lastCompanyUpsert = null;
    lastCreditUpsert = null;
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(installAuthFetchMock()));
  });

  describe("GET /system-settings", () => {
    test("Super Admin gets settings including the company profile", async () => {
      const { default: app } = await import("../index");
      const res = await app.request("/api/v1/system-settings", { headers: headers("neon-super-admin") }, env);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.creditOverdueDays).toBe(45);
      expect(body.data.company).toMatchObject({
        legalName: "Distribution OS",
        gstin: "36ABCDE1234F1Z5",
        addressLine1: "",
        addressLine2: "",
        city: "",
        state: "",
        pincode: "",
      });
    });

    test("Manager is forbidden", async () => {
      const { default: app } = await import("../index");
      const res = await app.request("/api/v1/system-settings", { headers: headers("neon-manager") }, env);
      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /system-settings", () => {
    test("saves the company profile and upper-cases GSTIN", async () => {
      const { default: app } = await import("../index");
      const res = await app.request(
        "/api/v1/system-settings",
        {
          method: "PATCH",
          headers: headers("neon-super-admin"),
          body: JSON.stringify({
            company: {
              legalName: "Acme Lubes",
              gstin: "36abcde1234f1z5",
              addressLine1: "12 MG Road",
              addressLine2: "",
              city: "Hyderabad",
              state: "Telangana",
              pincode: "500001",
            },
          }),
        },
        env,
      );
      expect(res.status).toBe(200);
      expect(lastCompanyUpsert?.keys).toEqual([
        "company_legal_name",
        "company_gstin",
        "company_address_line1",
        "company_address_line2",
        "company_city",
        "company_state",
        "company_pincode",
      ]);
      expect(lastCompanyUpsert?.values).toEqual([
        "Acme Lubes",
        "36ABCDE1234F1Z5",
        "12 MG Road",
        "",
        "Hyderabad",
        "Telangana",
        "500001",
      ]);
    });

    test("rejects a missing required address field with 422", async () => {
      const { default: app } = await import("../index");
      const res = await app.request(
        "/api/v1/system-settings",
        {
          method: "PATCH",
          headers: headers("neon-super-admin"),
          body: JSON.stringify({
            company: { legalName: "Acme", gstin: "", addressLine1: "12 MG Road", addressLine2: "", city: "", state: "Telangana", pincode: "500001" },
          }),
        },
        env,
      );
      expect(res.status).toBe(422);
    });

    test("rejects a malformed GSTIN with 422", async () => {
      const { default: app } = await import("../index");
      const res = await app.request(
        "/api/v1/system-settings",
        {
          method: "PATCH",
          headers: headers("neon-super-admin"),
          body: JSON.stringify({ company: { gstin: "too-short" } }),
        },
        env,
      );
      expect(res.status).toBe(422);
      expect(lastCompanyUpsert).toBeNull();
    });

    test("still saves the credit overdue threshold", async () => {
      const { default: app } = await import("../index");
      const res = await app.request(
        "/api/v1/system-settings",
        {
          method: "PATCH",
          headers: headers("neon-super-admin"),
          body: JSON.stringify({ creditOverdueDays: 30 }),
        },
        env,
      );
      expect(res.status).toBe(200);
      expect(lastCreditUpsert).toBe("30");
    });
  });
});
