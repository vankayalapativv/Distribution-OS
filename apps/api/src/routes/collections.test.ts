import { beforeEach, describe, expect, test, vi } from "vitest";
import { authHeaders, authTestEnv, installAuthFetchMock } from "../test/auth";

const SUPER_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const MANAGER_ID = "00000000-0000-4000-8000-000000000002";
const ACCOUNTANT_ID = "00000000-0000-4000-8000-000000000003";
const SE_ID = "00000000-0000-4000-8000-000000000004";
const CUSTOMER_ID = "00000000-0000-4000-8000-000000000501";
const COLLECTION_ID = "00000000-0000-4000-8000-000000000601";
const VERIFIED_COLLECTION_ID = "00000000-0000-4000-8000-000000000602";
const INVOICE_ID = "00000000-0000-4000-8000-000000000701";
const PROOF_ID = "00000000-0000-4000-8000-000000000801";

const sampleCollection = {
  id: COLLECTION_ID,
  collectionCode: "COLL-0001",
  collectionDate: "2026-07-08",
  customerId: CUSTOMER_ID,
  customerName: "Raj Motors Pvt Ltd",
  collectedByUserId: SE_ID,
  collectedByName: "Arjun SE",
  paymentMode: "cash",
  paymentReferenceNumber: null,
  collectionAmount: "5000.00",
  chequeDate: null,
  chequeStatus: null,
  bankName: null,
  matchedStatus: "unmatched",
  accountantApprovalStatus: "pending",
  approvedByAccountantId: null,
  approvedAt: null,
  incentiveEligible: false,
  remarks: null,
  createdBy: MANAGER_ID,
  createdAt: "2026-07-08T10:00:00.000Z",
  updatedAt: "2026-07-08T10:00:00.000Z",
};

const sampleAllocation = {
  id: "00000000-0000-4000-8000-000000000801",
  collectionId: COLLECTION_ID,
  invoiceId: INVOICE_ID,
  invoiceNumber: "INV-0001",
  allocatedAmount: "5000.00",
};

const OTHER_CUSTOMER_INVOICE_ID = "00000000-0000-4000-8000-000000000702";

// Executed query tags, so tests can assert what ran (e.g. allocation insert).
const queryLog: string[] = [];

let lastListCollectionsValues: unknown[] = [];

// Mutable per-test state for the reconciliation-at-verify flow.
let mockReconcileAllocations: { invoiceId: string; allocatedAmount: string }[] = [];
let mockOutstandingInvoices: { id: string; outstandingAmount: string }[] = [];
let verifyCollectionUpdateShouldSucceed = true;
let verifyCollectionFallbackStatus: "pending" | "verified" | "rejected" = "verified";
// verifyCollection() returns getCollectionById() at the end, so the detail the
// client sees must reflect the verify/reject that just happened. This mirrors that.
let collectionApprovalState: "pending" | "verified" | "rejected" = "pending";

vi.mock("@neondatabase/serverless", () => {
  const mockSql = Object.assign(
    async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join(" ");
    const tag = query.match(/\/\*\s*([a-z0-9_]+)\s*\*\//i);
    if (tag) queryLog.push(tag[1]);

    if (query.includes("get_allocations_for_reconcile")) {
      return mockReconcileAllocations;
    }
    // The explicit-allocation target's outstanding (cap-and-spill, 2026-08-20).
    // Ample outstanding so an explicit allocation applies in full (no cap/spill).
    if (query.includes("explicit_alloc_target_outstanding")) {
      return [{ o: "1000000.00" }];
    }
    if (query.includes("list_outstanding_invoices_for_reconcile")) {
      return mockOutstandingInvoices;
    }
    if (query.includes("apply_allocation_to_invoice")) {
      return [];
    }

    if (query.includes("assert_customer_visible")) {
      return values.includes(CUSTOMER_ID) ? [{ id: CUSTOMER_ID }] : [];
    }
    if (query.includes("get_invoice_for_allocation")) {
      if (values.includes(INVOICE_ID)) {
        return [{ id: INVOICE_ID, customerId: CUSTOMER_ID }];
      }
      if (values.includes(OTHER_CUSTOMER_INVOICE_ID)) {
        return [{ id: OTHER_CUSTOMER_INVOICE_ID, customerId: "00000000-0000-4000-8000-000000000599" }];
      }
      return [];
    }

    if (query.includes("create_collection_allocation")) {
      return [];
    }

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
          userId: userIdBySubject[subject] ?? SUPER_ADMIN_ID,
        },
      ];
    }

    if (query.includes("list_collections")) {
      lastListCollectionsValues = values;
      return [sampleCollection];
    }

    if (query.includes("get_collection_by_id")) {
      if (values.includes(COLLECTION_ID)) {
        return [{ ...sampleCollection, status: "pending", accountantApprovalStatus: collectionApprovalState }];
      }
      if (values.includes(VERIFIED_COLLECTION_ID)) {
        return [{ ...sampleCollection, id: VERIFIED_COLLECTION_ID, status: "verified" }];
      }
      return [];
    }

    if (query.includes("get_collection_verify_status")) {
      if (values.includes(COLLECTION_ID)) {
        return [{ id: COLLECTION_ID, status: verifyCollectionFallbackStatus }];
      }
      if (values.includes(VERIFIED_COLLECTION_ID)) {
        return [{ id: VERIFIED_COLLECTION_ID, status: "verified" }];
      }
      return [];
    }

    if (query.includes("get_collection_allocations")) {
      return values.includes(COLLECTION_ID) ? [sampleAllocation] : [];
    }

    if (query.includes("get_collection_proof_meta")) {
      return values.includes(COLLECTION_ID)
        ? [{ id: PROOF_ID, contentType: "image/jpeg", createdAt: "2026-07-20T10:00:00.000Z" }]
        : [];
    }

    if (query.includes("get_collection_proof_file")) {
      return values.includes(COLLECTION_ID)
        ? [{ fileKey: "collections/601/proof.jpg", contentType: "image/jpeg" }]
        : [];
    }

    if (query.includes("next_collection_code")) {
      return [{ next_seq: 1 }];
    }

    if (query.includes("create_collection")) {
      return [sampleCollection];
    }

    if (query.includes("verify_collection")) {
      if (!values.includes(COLLECTION_ID) || !verifyCollectionUpdateShouldSucceed) {
        return [];
      }
      collectionApprovalState = "verified";
      return [{ ...sampleCollection, accountantApprovalStatus: "verified" }];
    }

    if (query.includes("reject_collection")) {
      collectionApprovalState = "rejected";
      return [{ ...sampleCollection, accountantApprovalStatus: "rejected", remarks: "Cheque bounced" }];
    }

    if (query.includes("create_rejection_alert")) {
      return [{ id: "00000000-0000-4000-8000-000000000901" }];
    }

    if (query.includes("get_se_for_collection")) {
      return [{ executiveId: SE_ID }];
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

describe("collections routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(installAuthFetchMock()),
    );
    queryLog.length = 0;
    mockReconcileAllocations = [];
    mockOutstandingInvoices = [];
    verifyCollectionUpdateShouldSucceed = true;
    verifyCollectionFallbackStatus = "verified";
    collectionApprovalState = "pending";
  });

  // ── GET /collections ────────────────────────────────────────────────────────

  describe("GET /collections", () => {
    test("customerId filter is applied to the query", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/collections?customerId=${CUSTOMER_ID}`,
        { headers: headers("neon-se") },
        env,
      );

      expect(res.status).toBe(200);
      // the bind values of list_collections must include the customer filter
      expect(lastListCollectionsValues).toContain(CUSTOMER_ID);
    });

    test("Super Admin can list collections", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/collections",
        { headers: headers("neon-super-admin") },
        env,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: [{ collectionCode: "COLL-0001", paymentMode: "cash", accountantApprovalStatus: "pending" }],
      });
    });

    test("Manager can list collections", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/collections",
        { headers: headers("neon-manager") },
        env,
      );

      expect(res.status).toBe(200);
    });

    test("Accountant can list collections", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/collections",
        { headers: headers("neon-accountant") },
        env,
      );

      expect(res.status).toBe(200);
    });

    test("Unauthenticated request returns 401", async () => {
      const { default: app } = await import("../index");

      const res = await app.request("/api/v1/collections", {}, env);

      expect(res.status).toBe(401);
    });
  });

  // ── GET /collections/:id ────────────────────────────────────────────────────

  describe("GET /collections/:id", () => {
    test("Super Admin can get a collection by ID with allocations", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/collections/${COLLECTION_ID}`,
        { headers: headers("neon-super-admin") },
        env,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: {
          id: COLLECTION_ID,
          collectionCode: "COLL-0001",
          allocations: [{ invoiceNumber: "INV-0001" }],
        },
      });
    });

    test("Accountant can get a collection by ID", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/collections/${COLLECTION_ID}`,
        { headers: headers("neon-accountant") },
        env,
      );

      expect(res.status).toBe(200);
    });

    test("Returns 404 when collection not found", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/collections/00000000-0000-4000-8000-000000000000`,
        { headers: headers("neon-super-admin") },
        env,
      );

      expect(res.status).toBe(404);
    });

    test("detail includes the receipt proof metadata when one exists", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/collections/${COLLECTION_ID}`,
        { headers: headers("neon-accountant") },
        env,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.proof).toMatchObject({ id: PROOF_ID, contentType: "image/jpeg" });
    });
  });

  // ── GET /collections/:id/proof ──────────────────────────────────────────────

  describe("GET /collections/:id/proof", () => {
    const proofEnv = {
      ...env,
      PHOTOS: {
        get: async (key: string) => ({
          body: new Blob([new Uint8Array([1, 2, 3])]).stream(),
          key,
        }),
      },
    };

    test("Accountant can stream the receipt image", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/collections/${COLLECTION_ID}/proof`,
        { headers: headers("neon-accountant") },
        proofEnv,
      );

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    });

    test("Super Admin can stream the receipt image", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/collections/${COLLECTION_ID}/proof`,
        { headers: headers("neon-super-admin") },
        proofEnv,
      );

      expect(res.status).toBe(200);
    });

    test("Manager is forbidden from viewing receipts", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/collections/${COLLECTION_ID}/proof`,
        { headers: headers("neon-manager") },
        proofEnv,
      );

      expect(res.status).toBe(403);
    });

    test("404 when the collection has no receipt", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/collections/00000000-0000-4000-8000-000000000000/proof`,
        { headers: headers("neon-accountant") },
        proofEnv,
      );

      expect(res.status).toBe(404);
    });
  });

  // ── POST /collections ───────────────────────────────────────────────────────

  describe("POST /collections", () => {
    const newCollectionBody = {
      customerId: CUSTOMER_ID,
      collectionDate: "2026-07-08",
      paymentMode: "cash",
      collectionAmount: 5000,
    };

    test("Super Admin can create a collection", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/collections",
        {
          method: "POST",
          headers: headers("neon-super-admin"),
          body: JSON.stringify(newCollectionBody),
        },
        env,
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: { collectionCode: "COLL-0001", paymentMode: "cash" },
      });
    });

    test("Manager can create a collection", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/collections",
        {
          method: "POST",
          headers: headers("neon-manager"),
          body: JSON.stringify(newCollectionBody),
        },
        env,
      );

      expect(res.status).toBe(201);
    });

    test("invoiceId allocates the collection to that invoice", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/collections",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({ ...newCollectionBody, invoiceId: INVOICE_ID }),
        },
        env,
      );

      expect(res.status).toBe(201);
      expect(queryLog).toContain("create_collection_allocation");
    });

    test("invoiceId belonging to a different customer returns 422 and creates nothing", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/collections",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({ ...newCollectionBody, invoiceId: OTHER_CUSTOMER_INVOICE_ID }),
        },
        env,
      );

      expect(res.status).toBe(422);
      expect(queryLog).not.toContain("create_collection");
      expect(queryLog).not.toContain("create_collection_allocation");
    });

    test("unknown invoiceId returns 422", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/collections",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({
            ...newCollectionBody,
            invoiceId: "00000000-0000-4000-8000-000000000799",
          }),
        },
        env,
      );

      expect(res.status).toBe(422);
    });

    test("no invoiceId → no allocation is written", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/collections",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify(newCollectionBody),
        },
        env,
      );

      expect(res.status).toBe(201);
      expect(queryLog).not.toContain("create_collection_allocation");
    });

    test("Accountant cannot create a collection", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/collections",
        {
          method: "POST",
          headers: headers("neon-accountant"),
          body: JSON.stringify(newCollectionBody),
        },
        env,
      );

      expect(res.status).toBe(403);
    });

    test("Missing customerId returns 422", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/collections",
        {
          method: "POST",
          headers: headers("neon-super-admin"),
          body: JSON.stringify({ paymentMode: "cash", collectionAmount: 5000, collectionDate: "2026-07-08" }),
        },
        env,
      );

      expect(res.status).toBe(422);
    });

    test("Missing paymentMode returns 422", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/collections",
        {
          method: "POST",
          headers: headers("neon-super-admin"),
          body: JSON.stringify({ customerId: CUSTOMER_ID, collectionAmount: 5000, collectionDate: "2026-07-08" }),
        },
        env,
      );

      expect(res.status).toBe(422);
    });

    test("Invalid paymentMode returns 422", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/collections",
        {
          method: "POST",
          headers: headers("neon-super-admin"),
          body: JSON.stringify({ ...newCollectionBody, paymentMode: "bitcoin" }),
        },
        env,
      );

      expect(res.status).toBe(422);
    });

    test("Missing collectionAmount returns 422", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/collections",
        {
          method: "POST",
          headers: headers("neon-super-admin"),
          body: JSON.stringify({ customerId: CUSTOMER_ID, paymentMode: "cash", collectionDate: "2026-07-08" }),
        },
        env,
      );

      expect(res.status).toBe(422);
    });
  });

  // ── POST /collections/:id/verify ────────────────────────────────────────────

  describe("POST /collections/:id/verify", () => {
    test("verification applies an explicit allocation to its invoice", async () => {
      mockReconcileAllocations = [{ invoiceId: INVOICE_ID, allocatedAmount: "5000.00" }];
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/collections/${COLLECTION_ID}/verify`,
        { method: "POST", headers: headers("neon-accountant") },
        env,
      );

      expect(res.status).toBe(200);
      expect(queryLog.filter((q) => q === "apply_allocation_to_invoice")).toHaveLength(1);
      expect(queryLog).not.toContain("create_collection_allocation"); // no auto-allocation needed
    });

    test("verifying a general payment auto-allocates oldest-first across outstanding invoices", async () => {
      // collection amount is 5000 (sampleCollection); two open invoices 3000 + 4000
      mockOutstandingInvoices = [
        { id: "00000000-0000-4000-8000-000000000711", outstandingAmount: "3000.00" },
        { id: "00000000-0000-4000-8000-000000000712", outstandingAmount: "4000.00" },
      ];
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/collections/${COLLECTION_ID}/verify`,
        { method: "POST", headers: headers("neon-accountant") },
        env,
      );

      expect(res.status).toBe(200);
      // 3000 to the oldest, remaining 2000 to the next — two allocations, two invoice updates
      expect(queryLog.filter((q) => q === "create_collection_allocation")).toHaveLength(2);
      expect(queryLog.filter((q) => q === "apply_allocation_to_invoice")).toHaveLength(2);
    });

    test("verifying a general payment with no outstanding invoices still succeeds", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/collections/${COLLECTION_ID}/verify`,
        { method: "POST", headers: headers("neon-accountant") },
        env,
      );

      expect(res.status).toBe(200);
      expect(queryLog).not.toContain("create_collection_allocation");
      expect(queryLog).not.toContain("apply_allocation_to_invoice");
    });

    test("Accountant can verify a collection", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/collections/${COLLECTION_ID}/verify`,
        {
          method: "POST",
          headers: headers("neon-accountant"),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: { accountantApprovalStatus: "verified" },
      });
    });

    test("Super Admin can verify a collection", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/collections/${COLLECTION_ID}/verify`,
        {
          method: "POST",
          headers: headers("neon-super-admin"),
        },
        env,
      );

      expect(res.status).toBe(200);
    });

    test("Manager cannot verify a collection", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/collections/${COLLECTION_ID}/verify`,
        {
          method: "POST",
          headers: headers("neon-manager"),
        },
        env,
      );

      expect(res.status).toBe(403);
    });

    test("Returns 404 when collection not found", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/collections/00000000-0000-4000-8000-000000000000/verify`,
        {
          method: "POST",
          headers: headers("neon-accountant"),
        },
        env,
      );

      expect(res.status).toBe(404);
    });

    test("Returns 409 when collection is already verified", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/collections/${VERIFIED_COLLECTION_ID}/verify`,
        {
          method: "POST",
          headers: headers("neon-accountant"),
        },
        env,
      );

      expect(res.status).toBe(409);
    });

    test("returns 409 without reconciliation if another request verifies the collection first", async () => {
      verifyCollectionUpdateShouldSucceed = false;
      mockOutstandingInvoices = [
        { id: INVOICE_ID, outstandingAmount: "5000.00" },
      ];
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/collections/${COLLECTION_ID}/verify`,
        {
          method: "POST",
          headers: headers("neon-accountant"),
        },
        env,
      );

      expect(res.status).toBe(409);
      expect(queryLog).not.toContain("create_collection_allocation");
      expect(queryLog).not.toContain("apply_allocation_to_invoice");
    });
  });

  // ── POST /collections/:id/reject ────────────────────────────────────────────

  describe("POST /collections/:id/reject", () => {
    test("Accountant can reject a collection with a remark", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/collections/${COLLECTION_ID}/reject`,
        {
          method: "POST",
          headers: headers("neon-accountant"),
          body: JSON.stringify({ remark: "Cheque bounced" }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: { accountantApprovalStatus: "rejected" },
      });
    });

    test("Super Admin can reject a collection", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/collections/${COLLECTION_ID}/reject`,
        {
          method: "POST",
          headers: headers("neon-super-admin"),
          body: JSON.stringify({ remark: "Wrong amount" }),
        },
        env,
      );

      expect(res.status).toBe(200);
    });

    test("Manager cannot reject a collection", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/collections/${COLLECTION_ID}/reject`,
        {
          method: "POST",
          headers: headers("neon-manager"),
          body: JSON.stringify({ remark: "Wrong amount" }),
        },
        env,
      );

      expect(res.status).toBe(403);
    });

    test("Missing remark returns 422", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/collections/${COLLECTION_ID}/reject`,
        {
          method: "POST",
          headers: headers("neon-accountant"),
          body: JSON.stringify({}),
        },
        env,
      );

      expect(res.status).toBe(422);
    });

    test("Returns 404 when collection not found", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/collections/00000000-0000-4000-8000-000000000000/reject`,
        {
          method: "POST",
          headers: headers("neon-accountant"),
          body: JSON.stringify({ remark: "Wrong amount" }),
        },
        env,
      );

      expect(res.status).toBe(404);
    });

    test("Returns 409 when collection is already verified", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/collections/${VERIFIED_COLLECTION_ID}/reject`,
        {
          method: "POST",
          headers: headers("neon-accountant"),
          body: JSON.stringify({ remark: "Too late" }),
        },
        env,
      );

      expect(res.status).toBe(409);
    });
  });
});
