import { beforeEach, describe, expect, test, vi } from "vitest";
import { authHeaders, authTestEnv, installAuthFetchMock } from "../test/auth";

const SE_ID = "00000000-0000-4000-8000-000000000004";
const MANAGER_ID = "00000000-0000-4000-8000-000000000002";

// Customers
const OVERDUE_CUSTOMER_ID = "00000000-0000-4000-8000-000000000501"; // has invoice 90 days overdue
const GOOD_CUSTOMER_ID = "00000000-0000-4000-8000-000000000502";    // outstanding but nothing past threshold
const UNKNOWN_CUSTOMER_ID = "00000000-0000-4000-8000-000000000599";

// Idempotency client UUIDs
const NEW_CLIENT_UUID = "10000000-0000-4000-8000-000000000001";
const EXISTING_VISIT_CLIENT_UUID = "10000000-0000-4000-8000-000000000002";
const EXISTING_ORDER_CLIENT_UUID = "10000000-0000-4000-8000-000000000003";
const EXISTING_COLLECTION_CLIENT_UUID = "10000000-0000-4000-8000-000000000004";

const STOP_ID = "00000000-0000-4000-8000-000000000701";
const BEAT_PLAN_ID = "00000000-0000-4000-8000-000000000601";
const VISIT_ID = "00000000-0000-4000-8000-000000000801";
const EXISTING_VISIT_ID = "00000000-0000-4000-8000-000000000802";
const ORDER_ID = "00000000-0000-4000-8000-000000000901";
const EXISTING_ORDER_ID = "00000000-0000-4000-8000-000000000902";
const PRODUCT_ID = "00000000-0000-4000-8000-000000000a01";
const COLLECTION_ID = "00000000-0000-4000-8000-000000000b01";
const EXISTING_COLLECTION_ID = "00000000-0000-4000-8000-000000000b02";
const GPS_SESSION_ID = "00000000-0000-4000-8000-000000000c01";

const SINCE_TS = "2026-07-08T00:00:00.000Z";

// Log of executed query tags so tests can assert what ran (e.g. no insert on replay)
const queryLog: string[] = [];

function logTag(query: string) {
  const m = query.match(/\/\*\s*([a-z0-9_]+)\s*\*\//i);
  if (m) queryLog.push(m[1]);
}

const customerRow = (id: string, name: string) => ({
  id,
  customerCode: "CUST-0001",
  legalName: name,
  tradeName: null,
  customerName: name,
  customerType: "retailer",
  segment: null,
  phone: "+911234567890",
  alternativePhone: null,
  gstNumber: null,
  panNumber: null,
  aadharNumber: null,
  addressStreet: null,
  addressCity: null,
  addressState: null,
  addressPincode: null,
  email: null,
  customerGrade: null,
  creditLimit: 100000,
  creditDays: 30,
  paymentStatus: "good",
  kycStatus: "pending",
  approvalStatus: "approved",
  status: "active",
  createdBy: MANAGER_ID,
});

const fullOrderRow = (id: string) => ({
  id,
  orderCode: "ORD-0001",
  orderDate: "2026-07-09",
  customerId: OVERDUE_CUSTOMER_ID,
  salesExecutiveId: SE_ID,
  orderStatus: "approved",
  approvalStatus: "approved",
  discountAmount: null,
  totalTaxableAmount: null,
  totalGstAmount: null,
  totalInvoiceValue: null,
  totalLitres: 10,
  deliveryAddress: null,
  deliveryNotes: null,
  remarks: null,
  createdBy: SE_ID,
  createdAt: "2026-07-09T09:00:00.000Z",
});

const fullCollectionRow = (id: string, code: string) => ({
  id,
  collectionCode: code,
  collectionDate: "2026-07-09",
  customerId: OVERDUE_CUSTOMER_ID,
  collectedByUserId: SE_ID,
  paymentMode: "cash",
  paymentReferenceNumber: null,
  collectionAmount: 5000,
  chequeDate: null,
  chequeStatus: null,
  bankName: null,
  matchedStatus: "unmatched",
  accountantApprovalStatus: "pending",
  approvedByAccountantId: null,
  approvedAt: null,
  incentiveEligible: null,
  remarks: null,
  createdBy: SE_ID,
  createdAt: "2026-07-09T09:00:00.000Z",
  updatedAt: "2026-07-09T09:00:00.000Z",
});

vi.mock("@neondatabase/serverless", () => {
  const mockSql = Object.assign(
    async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join(" ");
    logTag(query);

    // ── Auth ──────────────────────────────────────────────────────────────
    if (query.includes("auth_app_profile")) {
      const subject = values[0] as string;
      if (subject === "neon-se") return [{ role: "SALES_EXECUTIVE", userId: SE_ID , enterpriseId: "00000000-0000-4000-8000-0000000000e1"}];
      if (subject === "neon-manager") return [{ role: "MANAGER", userId: MANAGER_ID , enterpriseId: "00000000-0000-4000-8000-0000000000e1"}];
      return [];
    }

    if (query.includes("get_customer_exists") || query.includes("assert_customer_visible")) {
      return values.includes(OVERDUE_CUSTOMER_ID) || values.includes(GOOD_CUSTOMER_ID)
        ? [{ id: values[0] }]
        : [];
    }

    // ── Customer invoices (credit gate) ──────────────────────────────────
    if (query.includes("get_customer_for_invoices")) {
      if (values.includes(OVERDUE_CUSTOMER_ID)) {
        return [{ id: OVERDUE_CUSTOMER_ID, legalName: "Overdue Motors", creditLimit: 100000, creditDays: 30 }];
      }
      if (values.includes(GOOD_CUSTOMER_ID)) {
        return [{ id: GOOD_CUSTOMER_ID, legalName: "Good Traders", creditLimit: 50000, creditDays: 30 }];
      }
      return [];
    }
    if (query.includes("get_customer_credit_days")) {
      return [{ creditDays: 60 }];
    }
    if (query.includes("list_customer_outstanding_invoices")) {
      if (values.includes(OVERDUE_CUSTOMER_ID)) {
        return [
          {
            id: "00000000-0000-4000-8000-000000000d01",
            invoiceNumber: "INV-1001",
            invoiceDate: "2026-04-01",
            dueDate: "2026-04-10",
            netInvoiceValue: 20000,
            amountCollected: 5000,
            outstandingAmount: 15000,
            paymentStatus: "partial",
            daysOverdue: 90,
          },
          {
            id: "00000000-0000-4000-8000-000000000d02",
            invoiceNumber: "INV-1002",
            invoiceDate: "2026-07-01",
            dueDate: "2026-07-31",
            netInvoiceValue: 8000,
            amountCollected: 0,
            outstandingAmount: 8000,
            paymentStatus: "unpaid",
            daysOverdue: 0,
          },
        ];
      }
      if (values.includes(GOOD_CUSTOMER_ID)) {
        return [
          {
            id: "00000000-0000-4000-8000-000000000d03",
            invoiceNumber: "INV-2001",
            invoiceDate: "2026-07-01",
            dueDate: "2026-07-31",
            netInvoiceValue: 5000,
            amountCollected: 0,
            outstandingAmount: 5000,
            paymentStatus: "unpaid",
            daysOverdue: 0,
          },
        ];
      }
      return [];
    }
    // Net balance is now the stateless ledger balance (customers.ts) — for these
    // scenarios it equals Σ invoice_net_value − Σ collections: 28000−5000=23000
    // (overdue) and 5000−0=5000 (good), matching the expected totalOutstanding.
    if (query.includes("customer_net_ledger_balance")) {
      if (values.includes(OVERDUE_CUSTOMER_ID)) return [{ ledgerBalance: 23000 }];
      if (values.includes(GOOD_CUSTOMER_ID)) return [{ ledgerBalance: 5000 }];
      return [{ ledgerBalance: 0 }];
    }
    // Credit gate's overdue-beyond-threshold check (shared getCustomerCreditStatus):
    // the overdue customer has an invoice past the 60-day threshold; the good one doesn't.
    if (query.includes("customer_overdue_past_terms")) {
      if (values.includes(OVERDUE_CUSTOMER_ID)) return [{ invoiceOverdue: true, openingOverdue: false }];
      return [{ invoiceOverdue: false, openingOverdue: false }];
    }

    // ── Visits: idempotent check-in ───────────────────────────────────────
    if (query.includes("get_visit_by_client_uuid")) {
      if (values.includes(EXISTING_VISIT_CLIENT_UUID)) {
        return [{
          id: EXISTING_VISIT_ID,
          visitCode: "VIS-20260709-EXIST",
          checkInTime: "2026-07-09T08:00:00.000Z",
        }];
      }
      return [];
    }
    if (query.includes("get_beat_plan_stop_for_checkin")) {
      if (values.includes(STOP_ID)) {
        return [{
          id: STOP_ID,
          stopStatus: "pending",
          customerId: OVERDUE_CUSTOMER_ID,
          beatPlanId: BEAT_PLAN_ID,
          executiveId: SE_ID,
        }];
      }
      return [];
    }
    if (query.includes("create_unplanned_visit")) {
      return [{ id: VISIT_ID, visitCode: "VIS-20260709-UNPLN", checkInTime: "2026-07-09T10:00:00.000Z" }];
    }
    if (query.includes("create_visit")) {
      return [{ id: VISIT_ID, visitCode: "VIS-20260709-ABCDE", checkInTime: "2026-07-09T10:00:00.000Z" }];
    }
    if (query.includes("update_stop_on_checkin")) return [];
    if (query.includes("list_orders")) {
      return [fullOrderRow(EXISTING_ORDER_ID)];
    }

    // ── Orders: idempotent create, SE access ─────────────────────────────
    if (query.includes("get_order_by_client_uuid")) {
      if (values.includes(EXISTING_ORDER_CLIENT_UUID)) return [fullOrderRow(EXISTING_ORDER_ID)];
      return [];
    }
    if (query.includes("get_products_for_order")) {
      return [{ id: PRODUCT_ID }];
    }
    if (query.includes("next_order_code")) return [{ next_seq: 1 }];
    if (query.includes("create_order")) return [fullOrderRow(ORDER_ID)];
    if (query.includes("create_order_item")) return [];
    if (query.includes("get_order_items")) {
      return [{
        id: "00000000-0000-4000-8000-000000000e01",
        productId: PRODUCT_ID,
        productName: "Titan GT1 5W-40",
        quantityUnits: 2,
        packSizeLitres: 5,
        totalLitres: 10,
        segment: "Cars",
        hsnCode: null,
        gstPercentage: null,
        gstAmount: null,
        lineTotal: null,
      }];
    }

    // ── Collections: idempotent create ───────────────────────────────────
    if (query.includes("get_collection_by_client_uuid")) {
      if (values.includes(EXISTING_COLLECTION_CLIENT_UUID)) {
        return [fullCollectionRow(EXISTING_COLLECTION_ID, "COLL-0042")];
      }
      return [];
    }
    if (query.includes("next_collection_code")) return [{ next_seq: 1 }];
    if (query.includes("create_collection")) return [fullCollectionRow(COLLECTION_ID, "COLL-0001")];

    // ── GPS batch ─────────────────────────────────────────────────────────
    if (query.includes("get_gps_session_today")) return [];
    if (query.includes("create_gps_session")) return [{ id: GPS_SESSION_ID }];
    // Batched multi-row insert (unnest) now returns one id per inserted point;
    // `inserted` is the real row count, so echo back one row per point. Checked
    // before the legacy `insert_gps_point` branch (substring of this comment).
    if (query.includes("insert_gps_points_batch")) {
      const arr = values.find((v) => Array.isArray(v)) as unknown[] | undefined;
      return Array.from({ length: arr?.length ?? 0 }, (_, i) => ({ id: `gp-${i}` }));
    }
    if (query.includes("insert_gps_point")) return [];

    // ── Customer list (delta + SE access) ────────────────────────────────
    if (query.includes("list_customers")) {
      if (values.includes(SINCE_TS)) {
        return [customerRow(GOOD_CUSTOMER_ID, "Recently Updated Traders")];
      }
      return [
        customerRow(OVERDUE_CUSTOMER_ID, "Overdue Motors"),
        customerRow(GOOD_CUSTOMER_ID, "Good Traders"),
      ];
    }

    // ── Products list (delta) ─────────────────────────────────────────────
    if (query.includes("list_products")) {
      if (values.includes(SINCE_TS)) {
        return [{ id: PRODUCT_ID, productName: "Titan GT1 5W-40", segments: ["Cars"] }];
      }
      return [
        { id: PRODUCT_ID, productName: "Titan GT1 5W-40", segments: ["Cars"] },
        { id: "00000000-0000-4000-8000-000000000a02", productName: "Titan Super Gear", segments: ["Gear Oil"] },
      ];
    }

    return [];
    },
    { transaction: (queries: Promise<unknown>[]) => Promise.all(queries) },
  );
  return { neon: () => mockSql };
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

describe("mobile sync endpoints", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(installAuthFetchMock()),
    );
    queryLog.length = 0;
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe("GET /customers/:id/invoices (credit gate)", () => {
    test("SE gets outstanding invoices; creditBlocked=true when an invoice is overdue beyond threshold", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/customers/${OVERDUE_CUSTOMER_ID}/invoices`,
        { headers: headers("neon-se") },
        env,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.customer.id).toBe(OVERDUE_CUSTOMER_ID);
      expect(body.data.creditOverdueDays).toBe(60);
      expect(body.data.creditBlocked).toBe(true);
      expect(body.data.invoices).toHaveLength(2);
      expect(body.data.invoices[0].invoiceNumber).toBe("INV-1001");
      expect(body.data.invoices[0].daysOverdue).toBe(90);
      expect(body.data.totalOutstanding).toBe(23000);
    });

    test("creditBlocked=false when nothing is past the overdue threshold", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/customers/${GOOD_CUSTOMER_ID}/invoices`,
        { headers: headers("neon-se") },
        env,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.creditBlocked).toBe(false);
      expect(body.data.totalOutstanding).toBe(5000);
    });

    test("unknown customer → 404", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/customers/${UNKNOWN_CUSTOMER_ID}/invoices`,
        { headers: headers("neon-se") },
        env,
      );

      expect(res.status).toBe(404);
    });

    test("unauthenticated → 401", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/customers/${OVERDUE_CUSTOMER_ID}/invoices`,
        {},
        env,
      );

      expect(res.status).toBe(401);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe("POST /visits/gps/batch", () => {
    test("SE uploads queued pings → 201 with inserted count", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/visits/gps/batch",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({
            points: [
              { latitude: 13.08, longitude: 80.27, recordedAt: "2026-07-09T09:00:00.000Z" },
              { latitude: 13.09, longitude: 80.28, recordedAt: "2026-07-09T09:05:00.000Z" },
            ],
          }),
        },
        env,
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.inserted).toBe(2);
      expect(body.data.sessionId).toBe(GPS_SESSION_ID);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe("idempotent POST /visits/checkin", () => {
    test("new clientUuid → 201, visit created", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/visits/checkin",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({
            beatPlanStopId: STOP_ID,
            latitude: 13.08,
            longitude: 80.27,
            clientUuid: NEW_CLIENT_UUID,
          }),
        },
        env,
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.visitId).toBe(VISIT_ID);
      expect(queryLog).toContain("create_visit");
    });

    test("replayed clientUuid → 200 with the existing visit, no new insert", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/visits/checkin",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({
            beatPlanStopId: STOP_ID,
            latitude: 13.08,
            longitude: 80.27,
            clientUuid: EXISTING_VISIT_CLIENT_UUID,
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.visitId).toBe(EXISTING_VISIT_ID);
      expect(body.data.visitCode).toBe("VIS-20260709-EXIST");
      expect(queryLog).not.toContain("create_visit");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe("unplanned visits (no beat stop)", () => {
    test("check-in with customerId only records an unplanned visit", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/visits/checkin",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({
            customerId: OVERDUE_CUSTOMER_ID,
            latitude: 13.08,
            longitude: 80.27,
            clientUuid: NEW_CLIENT_UUID,
          }),
        },
        env,
      );

      expect(res.status).toBe(201);
      // Unplanned check-in via customerId uses the create_visit_from_customer path
      // (tag renamed from the old create_unplanned_visit).
      expect(queryLog).toContain("create_visit_from_customer");
      expect(queryLog).not.toContain("update_stop_on_checkin");
    });

    test("check-in without customerId AND without beatPlanStopId → 422", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/visits/checkin",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({ latitude: 13.08, longitude: 80.27 }),
        },
        env,
      );

      expect(res.status).toBe(422);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe("SE order history", () => {
    test("SALES_EXECUTIVE can list orders filtered by customer", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/orders?customerId=${OVERDUE_CUSTOMER_ID}`,
        { headers: headers("neon-se") },
        env,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.orders).toHaveLength(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe("SE customer ownership enforcement", () => {
    test("order for a foreign customer → 404", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/orders",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({
            customerId: UNKNOWN_CUSTOMER_ID,
            items: [{ productId: PRODUCT_ID, quantityUnits: 1, packSizeLitres: 5 }],
          }),
        },
        env,
      );

      expect(res.status).toBe(404);
      expect(queryLog).not.toContain("create_order");
    });

    test("collection for a foreign customer → 404", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/collections",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({
            customerId: UNKNOWN_CUSTOMER_ID,
            collectionDate: "2026-07-10",
            paymentMode: "cash",
            collectionAmount: 500,
          }),
        },
        env,
      );

      expect(res.status).toBe(404);
      expect(queryLog).not.toContain("create_collection");
    });

    test("unplanned check-in on a foreign customer → 404", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/visits/checkin",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({
            customerId: UNKNOWN_CUSTOMER_ID,
            latitude: 13.08,
            longitude: 80.27,
          }),
        },
        env,
      );

      expect(res.status).toBe(404);
    });

    test("SE order history without customerId → 422", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/orders",
        { headers: headers("neon-se") },
        env,
      );

      expect(res.status).toBe(422);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe("idempotent POST /orders + SE access", () => {
    const orderBody = (clientUuid: string) => ({
      customerId: OVERDUE_CUSTOMER_ID,
      clientUuid,
      items: [{ productId: PRODUCT_ID, quantityUnits: 2, packSizeLitres: 5, segment: "Cars" }],
    });

    test("SALES_EXECUTIVE can create an order → 201, salesExecutiveId defaults to self", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/orders",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify(orderBody(NEW_CLIENT_UUID)),
        },
        env,
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.order.id).toBe(ORDER_ID);
      expect(queryLog).toContain("create_order");
    });

    test("replayed clientUuid → 200 with the existing order, no new insert", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/orders",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify(orderBody(EXISTING_ORDER_CLIENT_UUID)),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.order.id).toBe(EXISTING_ORDER_ID);
      expect(queryLog).not.toContain("create_order");
      expect(queryLog).not.toContain("create_order_item");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe("idempotent POST /collections", () => {
    const collectionBody = (clientUuid: string) => ({
      customerId: OVERDUE_CUSTOMER_ID,
      collectionDate: "2026-07-09",
      paymentMode: "cash",
      collectionAmount: 5000,
      clientUuid,
    });

    test("new clientUuid → 201, collection created", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/collections",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify(collectionBody(NEW_CLIENT_UUID)),
        },
        env,
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.id).toBe(COLLECTION_ID);
      expect(queryLog).toContain("create_collection");
    });

    test("replayed clientUuid → 200 with the existing collection, no new insert", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/collections",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify(collectionBody(EXISTING_COLLECTION_CLIENT_UUID)),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.id).toBe(EXISTING_COLLECTION_ID);
      expect(body.data.collectionCode).toBe("COLL-0042");
      expect(queryLog).not.toContain("create_collection");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe("delta pulls with ?since=", () => {
    test("GET /customers?since= returns only rows updated after the timestamp", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/customers?since=${encodeURIComponent(SINCE_TS)}`,
        { headers: headers("neon-manager") },
        env,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].legalName).toBe("Recently Updated Traders");
    });

    test("SALES_EXECUTIVE can list customers", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/customers",
        { headers: headers("neon-se") },
        env,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(2);
    });

    test("SE can fetch products for order creation, with ?since= delta", async () => {
      const { default: app } = await import("../index");

      const full = await app.request(
        "/api/v1/orders/products",
        { headers: headers("neon-se") },
        env,
      );
      expect(full.status).toBe(200);
      const fullBody = await full.json();
      expect(fullBody.data.products).toHaveLength(2);

      const delta = await app.request(
        `/api/v1/orders/products?since=${encodeURIComponent(SINCE_TS)}`,
        { headers: headers("neon-se") },
        env,
      );
      expect(delta.status).toBe(200);
      const deltaBody = await delta.json();
      expect(deltaBody.data.products).toHaveLength(1);
    });
  });
});
