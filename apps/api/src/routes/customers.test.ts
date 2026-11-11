import { beforeEach, describe, expect, test, vi } from "vitest";
import { authHeaders, authTestEnv, installAuthFetchMock } from "../test/auth";

const SUPER_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const MANAGER_ID = "00000000-0000-4000-8000-000000000002";
const ACCOUNTANT_ID = "00000000-0000-4000-8000-000000000003";
const CUSTOMER_ID = "00000000-0000-4000-8000-000000000501";

// Captured bind values of the last create_customer insert.
let lastCreateValues: unknown[] = [];
let lastListValues: unknown[] = [];
let lastSeUpdateValues: unknown[] = [];
const SE_ID = "00000000-0000-4000-8000-000000000004";
const queryLog: string[] = [];

const sampleCustomer = {
  id: CUSTOMER_ID,
  customerCode: "CUST-0001",
  legalName: "Raj Motors Pvt Ltd",
  tradeName: "Raj Motors",
  customerType: "retail",
  segment: null,
  gstNumber: "29AAACR5055K1Z5",
  panNumber: null,
  email: null,
  customerGrade: "A",
  creditLimit: "50000.00",
  creditDays: 30,
  paymentStatus: "good",
  kycStatus: "pending",
  approvalStatus: "approved",
  status: "active",
  createdBy: SUPER_ADMIN_ID,
};

vi.mock("@neondatabase/serverless", () => ({
  neon: () => async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join(" ");

    if (query.includes("auth_app_profile")) {
      const roleBySubject: Record<string, string> = {
        "neon-super-admin": "SUPER_ADMIN",
        "neon-manager": "MANAGER",
        "neon-accountant": "ACCOUNTANT",
        "neon-se": "SALES_EXECUTIVE",
      };
      const subject = values[0] as string;
      const userIdBySubject: Record<string, string> = {
        "neon-super-admin": SUPER_ADMIN_ID,
        "neon-manager": MANAGER_ID,
        "neon-accountant": ACCOUNTANT_ID,
        "neon-se": "00000000-0000-4000-8000-000000000004",
      };
      return [
        {
          role: roleBySubject[subject],
          userId: userIdBySubject[subject] ?? SUPER_ADMIN_ID, enterpriseId: "00000000-0000-4000-8000-0000000000e1",
        },
      ];
    }

    const tag = query.match(/\/\*\s*([a-z0-9_]+)\s*\*\//i);
    if (tag) queryLog.push(tag[1]);

    if (query.includes("list_customers")) {
      lastListValues = values;
      return [sampleCustomer];
    }

    if (query.includes("get_customer_by_id")) {
      // Return empty to simulate 404 when a non-existent ID is requested.
      // Under SE scoping, "not yours" behaves the same as "doesn't exist":
      // the mock treats CUSTOMER_ID as owned by the SE.
      return values.includes(CUSTOMER_ID) ? [sampleCustomer] : [];
    }

    // Idempotent replay: a create whose clientUuid already exists returns that
    // row before any insert/phone-check. "11111111-…" is the seeded replay key.
    if (query.includes("get_customer_by_client_uuid")) {
      return values.includes("11111111-1111-4111-8111-111111111111") ? [sampleCustomer] : [];
    }

    if (query.includes("check_duplicate_phone")) {
      // "9999900000" is the phone that already exists in the mock DB.
      return values.includes("9999900000")
        ? [{ customerCode: "CUST-0001", legalName: "Existing Traders" }]
        : [];
    }

    if (query.includes("next_customer_code")) {
      return [{ next_seq: 1 }];
    }

    // A customer's owner must be an active SALES_EXECUTIVE (added 2026-07-12).
    // The SE user id (neon-se) is the active executive in these tests.
    if (query.includes("validate_owner_is_se")) {
      return values.includes("00000000-0000-4000-8000-000000000004") ? [{ ok: 1 }] : [];
    }

    if (query.includes("create_customer")) {
      lastCreateValues = values;
      return [sampleCustomer];
    }

    if (query.includes("update_customer_status")) {
      return [{ ...sampleCustomer, status: "inactive" }];
    }

    if (query.includes("update_customer_se_fields")) {
      lastSeUpdateValues = values;
      return values.includes(CUSTOMER_ID) ? [sampleCustomer] : [];
    }

    if (query.includes("update_customer")) {
      return [{ ...sampleCustomer, tradeName: "Raj Motors Updated" }];
    }

    // Credit gate (shared getCustomerCreditStatus) — folded into the header so the
    // mobile action row knows the blocked state at first paint. CUSTOMER_ID owes
    // and has an invoice overdue past the threshold → blocked.
    if (query.includes("get_customer_credit_days")) return [{ creditDays: 60 }];
    if (query.includes("customer_net_ledger_balance")) return [{ ledgerBalance: 12000 }];
    if (query.includes("customer_overdue_past_terms")) {
      return [{ invoiceOverdue: true, openingOverdue: false }];
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

describe("customers routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(installAuthFetchMock()),
    );
    queryLog.length = 0;
    lastListValues = [];
    lastCreateValues = [];
  });

  // ── GET /customers ─────────────────────────────────────────────────────────

  describe("GET /customers", () => {
    test("Super Admin can list customers", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/customers",
        { headers: headers("neon-super-admin") },
        env,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: [{ legalName: "Raj Motors Pvt Ltd", status: "active" }],
      });
    });

    test("Manager can list customers", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/customers",
        { headers: headers("neon-manager") },
        env,
      );

      expect(res.status).toBe(200);
    });

    test("Accountant can list customers", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/customers",
        { headers: headers("neon-accountant") },
        env,
      );

      expect(res.status).toBe(200);
    });

    test("Unauthenticated request returns 401", async () => {
      const { default: app } = await import("../index");

      const res = await app.request("/api/v1/customers", {}, env);

      expect(res.status).toBe(401);
    });
  });

  // ── SE visibility scoping (created_by) ──────────────────────────────────────

  describe("SE customer scoping", () => {
    test("SE list is scoped to customers they created", async () => {
      const { default: app } = await import("../index");

      const res = await app.request("/api/v1/customers", { headers: headers("neon-se") }, env);

      expect(res.status).toBe(200);
      expect(lastListValues).toContain(SE_ID); // created_by bind present
    });

    test("admin list is NOT creator-scoped", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/customers",
        { headers: headers("neon-super-admin") },
        env,
      );

      expect(res.status).toBe(200);
      expect(lastListValues).not.toContain(SE_ID);
    });

    test("SE PATCH on own customer updates only address/GPS via the restricted query", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/customers/${CUSTOMER_ID}`,
        {
          method: "PATCH",
          headers: headers("neon-se"),
          body: JSON.stringify({
            addressStreet: "14-2 New Bazaar",
            addressCity: "Khammam",
            latitude: 17.25,
            longitude: 80.15,
            creditLimit: 999999, // must be ignored for SE
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      expect(queryLog).toContain("update_customer_se_fields");
      expect(queryLog).not.toContain("update_customer"); // full-field path not used
    });

    test("SE PATCH can update the customer segment", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/customers/${CUSTOMER_ID}`,
        {
          method: "PATCH",
          headers: headers("neon-se"),
          body: JSON.stringify({ segment: "2W,Car,Agri" }),
        },
        env,
      );

      expect(res.status).toBe(200);
      expect(queryLog).toContain("update_customer_se_fields");
      expect(lastSeUpdateValues).toContain("2W,Car,Agri");
    });

    test("SE PATCH on a foreign customer → 404", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/customers/00000000-0000-4000-8000-000000000599",
        {
          method: "PATCH",
          headers: headers("neon-se"),
          body: JSON.stringify({ addressCity: "Khammam" }),
        },
        env,
      );

      expect(res.status).toBe(404);
    });

    test("admin PATCH keeps the full-field path", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/customers/${CUSTOMER_ID}`,
        {
          method: "PATCH",
          headers: headers("neon-super-admin"),
          body: JSON.stringify({ tradeName: "Raj Motors Updated" }),
        },
        env,
      );

      expect(res.status).toBe(200);
      expect(queryLog).toContain("update_customer");
    });
  });

  // ── POST /customers ────────────────────────────────────────────────────────

  describe("POST /customers", () => {
    const newCustomerBody = {
      legalName: "Raj Motors Pvt Ltd",
      tradeName: "Raj Motors",
      customerType: "retail",
      // Owner must be an active SALES_EXECUTIVE; assign the test SE (forced to
      // self for SE self-creates by the route).
      salesExecutiveId: "00000000-0000-4000-8000-000000000004",
      phone: "+919812345678",
      addressStreet: "3-4 Station Road",
      addressCity: "Khammam",
      addressPincode: "507001",
      gstNumber: "29AAACR5055K1Z5",
      customerGrade: "A",
      creditLimit: 50000,
      creditDays: 30,
    };

    // Authorization matrix: office creators (SA/Manager) and SEs (self-create)
    // may create → 201; the Accountant is read-only → 403. Parameterized to avoid
    // a near-identical test per role.
    test.each([
      ["Super Admin", "neon-super-admin", 201],
      ["Manager", "neon-manager", 201],
      ["Sales Executive", "neon-se", 201],
      ["Accountant", "neon-accountant", 403],
    ] as const)("%s create-customer → %i", async (_role, subject, expected) => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/customers",
        { method: "POST", headers: headers(subject), body: JSON.stringify(newCustomerBody) },
        env,
      );

      expect(res.status).toBe(expected);
    });

    test("returns the created customer record on success", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/customers",
        { method: "POST", headers: headers("neon-super-admin"), body: JSON.stringify(newCustomerBody) },
        env,
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: { legalName: "Raj Motors Pvt Ltd", status: "active" },
      });
    });

    test("replays an idempotent create (same clientUuid) without a second insert or phone-conflict", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/customers",
        {
          method: "POST",
          headers: headers("neon-se"),
          // Phone is the one that already exists — a non-idempotent retry would 409;
          // the matching clientUuid must short-circuit to the existing record first.
          body: JSON.stringify({
            ...newCustomerBody,
            phone: "+919999900000",
            clientUuid: "11111111-1111-4111-8111-111111111111",
          }),
        },
        env,
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      // The replay returns the existing row — no insert, no phone-duplicate check.
      expect(queryLog).toContain("get_customer_by_client_uuid");
      expect(queryLog).not.toContain("create_customer");
      expect(queryLog).not.toContain("check_duplicate_phone");
    });

    test("geo-location captured in the field is persisted", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/customers",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({
            ...newCustomerBody,
            latitude: 17.2473,
            longitude: 80.1514,
          }),
        },
        env,
      );

      expect(res.status).toBe(201);
      expect(lastCreateValues).toContain(17.2473);
      expect(lastCreateValues).toContain(80.1514);
    });

    test("Missing mandatory fields (phone, address, credit) return 422", async () => {
      const { default: app } = await import("../index");

      const { phone, addressStreet, creditLimit, ...withoutMandatory } = newCustomerBody;
      const res = await app.request(
        "/api/v1/customers",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify(withoutMandatory),
        },
        env,
      );

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error.message).toMatch(/phone/);
      expect(body.error.message).toMatch(/addressStreet/);
      expect(body.error.message).toMatch(/creditLimit/);
    });

    test("Duplicate phone number returns 409 with the existing customer", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/customers",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({ ...newCustomerBody, phone: "+91 99999 00000" }),
        },
        env,
      );

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error.message).toContain("Existing Traders");
      expect(body.error.message).toContain("CUST-0001");
    });

    test("Phone shorter than 10 digits returns 422", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/customers",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({ ...newCustomerBody, phone: "12345" }),
        },
        env,
      );

      expect(res.status).toBe(422);
    });

    test("Missing legalName returns 422", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/customers",
        {
          method: "POST",
          headers: headers("neon-super-admin"),
          body: JSON.stringify({ customerType: "retail" }),
        },
        env,
      );

      expect(res.status).toBe(422);
    });

    test("Missing customerType returns 422", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/customers",
        {
          method: "POST",
          headers: headers("neon-super-admin"),
          body: JSON.stringify({ legalName: "Test Customer" }),
        },
        env,
      );

      expect(res.status).toBe(422);
    });
  });

  // ── GET /customers/:id ─────────────────────────────────────────────────────

  describe("GET /customers/:id", () => {
    test("Super Admin can get a customer by ID", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/customers/${CUSTOMER_ID}`,
        { headers: headers("neon-super-admin") },
        env,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: { id: CUSTOMER_ID, legalName: "Raj Motors Pvt Ltd" },
      });
    });

    test("header carries the credit gate so the action row knows blocked at first paint", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/customers/${CUSTOMER_ID}`,
        { headers: headers("neon-super-admin") },
        env,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toMatchObject({
        creditBlocked: true,
        creditOverdueDays: 60,
        totalOutstanding: 12000,
      });
    });

    test("Manager can get a customer by ID", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/customers/${CUSTOMER_ID}`,
        { headers: headers("neon-manager") },
        env,
      );

      expect(res.status).toBe(200);
    });

    test("Accountant can get a customer by ID", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/customers/${CUSTOMER_ID}`,
        { headers: headers("neon-accountant") },
        env,
      );

      expect(res.status).toBe(200);
    });

    test("Returns 404 when customer not found", async () => {
      const { default: app } = await import("../index");

      // The top-level mock returns [] for any ID other than CUSTOMER_ID,
      // so this non-existent ID will trigger the 404 branch.
      const res = await app.request(
        `/api/v1/customers/00000000-0000-4000-8000-000000000000`,
        { headers: headers("neon-super-admin") },
        env,
      );

      expect(res.status).toBe(404);
    });
  });

  // ── PATCH /customers/:id ───────────────────────────────────────────────────

  describe("PATCH /customers/:id", () => {
    test("Super Admin can update a customer", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/customers/${CUSTOMER_ID}`,
        {
          method: "PATCH",
          headers: headers("neon-super-admin"),
          body: JSON.stringify({ tradeName: "Raj Motors Updated" }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: { tradeName: "Raj Motors Updated" },
      });
    });

    test("Manager can update a customer", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/customers/${CUSTOMER_ID}`,
        {
          method: "PATCH",
          headers: headers("neon-manager"),
          body: JSON.stringify({ tradeName: "Raj Motors Updated" }),
        },
        env,
      );

      expect(res.status).toBe(200);
    });

    test("Accountant cannot update a customer", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/customers/${CUSTOMER_ID}`,
        {
          method: "PATCH",
          headers: headers("neon-accountant"),
          body: JSON.stringify({ tradeName: "Raj Motors Updated" }),
        },
        env,
      );

      expect(res.status).toBe(403);
    });
  });

  // ── PATCH /customers/:id/status ────────────────────────────────────────────

  describe("PATCH /customers/:id/status", () => {
    test("Super Admin can deactivate a customer", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/customers/${CUSTOMER_ID}/status`,
        {
          method: "PATCH",
          headers: headers("neon-super-admin"),
          body: JSON.stringify({ status: "inactive" }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: { status: "inactive" },
      });
    });

    test("Manager can change customer status", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/customers/${CUSTOMER_ID}/status`,
        {
          method: "PATCH",
          headers: headers("neon-manager"),
          body: JSON.stringify({ status: "inactive" }),
        },
        env,
      );

      expect(res.status).toBe(200);
    });

    test("Accountant cannot change customer status", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/customers/${CUSTOMER_ID}/status`,
        {
          method: "PATCH",
          headers: headers("neon-accountant"),
          body: JSON.stringify({ status: "inactive" }),
        },
        env,
      );

      expect(res.status).toBe(403);
    });

    test("Invalid status value returns 422", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/customers/${CUSTOMER_ID}/status`,
        {
          method: "PATCH",
          headers: headers("neon-super-admin"),
          body: JSON.stringify({ status: "deleted" }),
        },
        env,
      );

      expect(res.status).toBe(422);
    });
  });

  // ── SE data-scoping / isolation (architecture audit G-0601) ──────────────────
  // A Sales Executive must only reach their OWN customers. "Not yours" must be
  // indistinguishable from "doesn't exist" (404) — on reads, not just writes.
  describe("SE data-scoping (isolation)", () => {
    const FOREIGN_ID = "00000000-0000-4000-8000-000000000599";

    test("SE reading their OWN customer by id → 200 (positive control)", async () => {
      const { default: app } = await import("../index");
      const res = await app.request(`/api/v1/customers/${CUSTOMER_ID}`, { headers: headers("neon-se") }, env);
      expect(res.status).toBe(200);
    });

    test("SE reading a FOREIGN customer by id → 404 (not-yours == not-found)", async () => {
      const { default: app } = await import("../index");
      const res = await app.request(`/api/v1/customers/${FOREIGN_ID}`, { headers: headers("neon-se") }, env);
      expect(res.status).toBe(404);
    });

    test("SE reading a FOREIGN customer's invoices → 404", async () => {
      const { default: app } = await import("../index");
      const res = await app.request(`/api/v1/customers/${FOREIGN_ID}/invoices`, { headers: headers("neon-se") }, env);
      expect(res.status).toBe(404);
    });
  });
});
