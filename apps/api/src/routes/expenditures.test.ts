import { beforeEach, describe, expect, test, vi } from "vitest";
import { authHeaders, authTestEnv, installAuthFetchMock } from "../test/auth";

const SUPER_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const MANAGER_ID = "00000000-0000-4000-8000-000000000002";
const ACCOUNTANT_ID = "00000000-0000-4000-8000-000000000003";
const SE_ID = "00000000-0000-4000-8000-000000000004";
const CATEGORY_ID = "00000000-0000-4000-8000-000000000a01";
const EXPENDITURE_ID = "00000000-0000-4000-8000-000000000b01";

const sampleRow = {
  id: EXPENDITURE_ID,
  expenditureCode: "EXP-0001",
  expenditureDate: new Date("2026-07-24T00:00:00.000Z"),
  categoryId: CATEGORY_ID,
  categoryName: "Rent",
  type: "compulsory",
  amount: "25000.00",
  paymentMode: "bank_transfer",
  paidTo: "Landlord",
  userId: null,
  userName: null,
  remarks: null,
  billFileKey: null,
  createdAt: "2026-07-24T05:00:00.000Z",
};

vi.mock("@neondatabase/serverless", () => {
  const handler = async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join(" ");

    if (query.includes("auth_app_profile")) {
      const roleBySubject: Record<string, string> = {
        "neon-super-admin": "SUPER_ADMIN",
        "neon-manager": "MANAGER",
        "neon-accountant": "ACCOUNTANT",
        "neon-se": "SALES_EXECUTIVE",
      };
      const userIdBySubject: Record<string, string> = {
        "neon-super-admin": SUPER_ADMIN_ID,
        "neon-manager": MANAGER_ID,
        "neon-accountant": ACCOUNTANT_ID,
        "neon-se": SE_ID,
      };
      const subject = values[0] as string;
      return [
        {
          role: roleBySubject[subject],
          userId: userIdBySubject[subject] ?? SUPER_ADMIN_ID, enterpriseId: "00000000-0000-4000-8000-0000000000e1",
        },
      ];
    }

    if (query.includes("list_expenditure_categories")) {
      return [
        { id: CATEGORY_ID, name: "Rent", type: "compulsory", isSystem: true, isActive: true },
        {
          id: "00000000-0000-4000-8000-000000000a02",
          name: "Customer Gifting",
          type: "variable",
          isSystem: true,
          isActive: true,
        },
      ];
    }

    if (query.includes("expenditure_category_exists")) {
      return values.includes("Rent") ? [{ id: CATEGORY_ID }] : [];
    }

    if (query.includes("create_expenditure_category")) {
      return [
        {
          id: "00000000-0000-4000-8000-000000000a09",
          name: values[0],
          type: values[1],
          isSystem: false,
          isActive: true,
        },
      ];
    }

    if (query.includes("expenditure_summary_by_category")) {
      return [
        {
          categoryId: CATEGORY_ID,
          categoryName: "Rent",
          type: "compulsory",
          entries: 1,
          amount: "25000.00",
        },
        {
          categoryId: "00000000-0000-4000-8000-000000000a02",
          categoryName: "Customer Gifting",
          type: "variable",
          entries: 2,
          amount: "4000.00",
        },
      ];
    }

    if (query.includes("expenditure_category_for_entry")) {
      return values.includes(CATEGORY_ID) ? [{ id: CATEGORY_ID }] : [];
    }

    if (query.includes("next_expenditure_code")) {
      return [{ next_seq: 1 }];
    }

    if (query.includes("create_expenditure")) {
      return [{ id: EXPENDITURE_ID }];
    }

    if (query.includes("delete_expenditure")) {
      return values.includes(EXPENDITURE_ID) ? [{ billFileKey: null }] : [];
    }

    return [];
  };

  // sql.query(text, params) is used by the paged/dynamic queries.
  handler.query = async (text: string, params: unknown[]) => {
    if (text.includes("list_expenditures_count")) {
      return [{ total: 1, total_amount: "25000.00" }];
    }
    if (text.includes("list_expenditures")) {
      return [sampleRow];
    }
    if (text.includes("get_expenditure_by_id")) {
      return params.includes(EXPENDITURE_ID) ? [sampleRow] : [];
    }
    return [];
  };

  return { neon: () => handler };
});

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

describe("expenditures routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(installAuthFetchMock()),
    );
  });

  describe("GET /expenditures/categories", () => {
    test.each(["neon-super-admin", "neon-manager", "neon-accountant"])(
      "%s can list categories",
      async (subject) => {
        const { default: app } = await import("../index");

        const res = await app.request(
          "/api/v1/expenditures/categories",
          { headers: headers(subject) },
          env,
        );

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.categories).toHaveLength(2);
        expect(body.data.categories[0]).toMatchObject({ name: "Rent", type: "compulsory" });
      },
    );

    test("a sales executive is forbidden", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/expenditures/categories",
        { headers: headers("neon-se") },
        env,
      );

      expect(res.status).toBe(403);
    });
  });

  describe("POST /expenditures/categories", () => {
    test("creates a custom category", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/expenditures/categories",
        {
          method: "POST",
          headers: headers("neon-manager"),
          body: JSON.stringify({ name: "Security Guard", type: "variable" }),
        },
        env,
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data).toMatchObject({ name: "Security Guard", type: "variable", isSystem: false });
    });

    test("rejects an unknown type", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/expenditures/categories",
        {
          method: "POST",
          headers: headers("neon-manager"),
          body: JSON.stringify({ name: "Nonsense", type: "occasional" }),
        },
        env,
      );

      expect(res.status).toBe(422);
    });

    test("rejects a duplicate name", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/expenditures/categories",
        {
          method: "POST",
          headers: headers("neon-accountant"),
          body: JSON.stringify({ name: "Rent", type: "compulsory" }),
        },
        env,
      );

      expect(res.status).toBe(409);
    });
  });

  describe("GET /expenditures/summary", () => {
    test("splits totals into compulsory and variable", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/expenditures/summary?from=2026-07-01&to=2026-07-31",
        { headers: headers("neon-super-admin") },
        env,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toMatchObject({
        total: 29000,
        compulsory: 25000,
        variable: 4000,
        entries: 3,
      });
      expect(body.data.categories).toHaveLength(2);
    });
  });

  describe("GET /expenditures", () => {
    test("lists entries with the period total", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/expenditures?page=1&pageSize=8",
        { headers: headers("neon-accountant") },
        env,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.total).toBe(1);
      expect(body.data.totalAmount).toBe(25000);
      expect(body.data.rows[0]).toMatchObject({
        expenditureCode: "EXP-0001",
        categoryName: "Rent",
        type: "compulsory",
        amount: 25000,
        // Date object from Neon must serialise to a plain YYYY-MM-DD
        expenditureDate: "2026-07-24",
        hasBill: false,
      });
    });
  });

  describe("POST /expenditures", () => {
    test("records an expenditure", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/expenditures",
        {
          method: "POST",
          headers: headers("neon-manager"),
          body: JSON.stringify({
            expenditureDate: "2026-07-24",
            categoryId: CATEGORY_ID,
            amount: 25000,
            paymentMode: "bank_transfer",
            paidTo: "Landlord",
          }),
        },
        env,
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data).toMatchObject({ expenditureCode: "EXP-0001", amount: 25000 });
    });

    test("rejects a zero or negative amount", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/expenditures",
        {
          method: "POST",
          headers: headers("neon-manager"),
          body: JSON.stringify({
            expenditureDate: "2026-07-24",
            categoryId: CATEGORY_ID,
            amount: 0,
          }),
        },
        env,
      );

      expect(res.status).toBe(422);
    });

    test("rejects an unknown payment mode", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/expenditures",
        {
          method: "POST",
          headers: headers("neon-manager"),
          body: JSON.stringify({
            expenditureDate: "2026-07-24",
            categoryId: CATEGORY_ID,
            amount: 500,
            paymentMode: "barter",
          }),
        },
        env,
      );

      expect(res.status).toBe(422);
    });

    test("a sales executive cannot record an expenditure", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/expenditures",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({
            expenditureDate: "2026-07-24",
            categoryId: CATEGORY_ID,
            amount: 500,
          }),
        },
        env,
      );

      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /expenditures/:id", () => {
    test("deletes an entry", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/expenditures/${EXPENDITURE_ID}`,
        { method: "DELETE", headers: headers("neon-super-admin") },
        env,
      );

      expect(res.status).toBe(200);
    });

    test("404 for an unknown entry", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/expenditures/00000000-0000-4000-8000-000000000000",
        { method: "DELETE", headers: headers("neon-super-admin") },
        env,
      );

      expect(res.status).toBe(404);
    });
  });
});
