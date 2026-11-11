import { beforeEach, describe, expect, test, vi } from "vitest";
import { authHeaders, authTestEnv, installAuthFetchMock } from "../test/auth";

const SUPER_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const MANAGER_ID = "00000000-0000-4000-8000-000000000002";
const ACCOUNTANT_ID = "00000000-0000-4000-8000-000000000003";
const ORDER_ID = "00000000-0000-4000-8000-000000000701";
const CUSTOMER_ID = "00000000-0000-4000-8000-000000000501";
const PRODUCT_ID = "00000000-0000-4000-8000-000000000801";
const QTY_PRODUCT_ID = "00000000-0000-4000-8000-000000000802";
const sampleProduct = {
  id: PRODUCT_ID,
  productCode: "PROD-001",
  productName: "Titan Premium 15W-40",
  packSizeLitres: "1.00",
  hsnCode: "27101990",
  gstPercentage: "18.00",
  mrp: "500.00",
  basicPrice: "420.00",
  status: "active",
};

const sampleOrderItem = {
  id: "00000000-0000-4000-8000-000000000901",
  productId: PRODUCT_ID,
  productCode: "PROD-001",
  productName: "Titan Premium 15W-40",
  quantityUnits: "10.00",
  packSizeLitres: "1.00",
  totalLitres: "10.00",
  estimatedUnitPrice: "420.00",
  estimatedLineValue: "4200.00",
  hsnCode: "27101990",
  gstPercentage: "18.00",
  gstAmount: "756.00",
  lineTotal: "4956.00",
};

const sampleOrder = {
  id: ORDER_ID,
  orderCode: "ORD-0001",
  orderDate: "2026-07-05",
  customerId: CUSTOMER_ID,
  customerName: "Raj Motors Pvt Ltd",
  orderStatus: "approved",
  approvalStatus: "approved",
  discountAmount: "0.00",
  totalTaxableAmount: "4200.00",
  totalGstAmount: "756.00",
  totalInvoiceValue: "4956.00",
  totalLitres: "10.00",
  deliveryAddress: null,
  deliveryNotes: null,
  remarks: null,
  createdBy: SUPER_ADMIN_ID,
  createdAt: "2026-07-05T10:00:00Z",
};

const env = {
  DATABASE_URL: "postgresql://example.test/db",
  ...authTestEnv,
};

vi.mock("@neondatabase/serverless", () => {
  const mockSql = Object.assign(
    async (strings: TemplateStringsArray, ...values: unknown[]) => {
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

    if (query.includes("list_products")) {
      return [sampleProduct];
    }

    if (query.includes("get_products_for_order")) {
      return [
        {
          id: PRODUCT_ID,
          unit: "litres",
          brand: "Fuchs",
          pack_size_litres: "1.00",
          hsn_code: "27101990",
          gst_percentage: "18.00",
        },
        {
          id: QTY_PRODUCT_ID,
          unit: "quantity",
          brand: "Texspin",
        },
      ];
    }

    if (query.includes("list_orders")) {
      return [sampleOrder];
    }

    if (query.includes("get_order_by_id")) {
      return values.includes(ORDER_ID) ? [sampleOrder] : [];
    }

    if (query.includes("get_order_items")) {
      return [sampleOrderItem];
    }

    if (query.includes("next_order_code")) {
      return [{ next_seq: 1 }];
    }

    if (query.includes("create_order")) {
      return [sampleOrder];
    }

    if (query.includes("create_order_item")) {
      return [sampleOrderItem];
    }

    return [];
    },
    { transaction: (queries: Promise<unknown>[]) => Promise.all(queries) },
  );
  return { neon: () => mockSql };
});

beforeEach(() => {
  vi.resetModules();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json(installAuthFetchMock()),
  );
});

describe("GET /orders/products", () => {
  test("SUPER_ADMIN can list products", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(
      "/orders/products",
      { headers: authHeaders("neon-super-admin") },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { products: unknown[] } };
    expect(body.success).toBe(true);
    expect(body.data.products).toHaveLength(1);
  });

  test("MANAGER can list products", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(
      "/orders/products",
      { headers: authHeaders("neon-manager") },
      env,
    );
    expect(res.status).toBe(200);
  });

  test("ACCOUNTANT can list products", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(
      "/orders/products",
      { headers: authHeaders("neon-accountant") },
      env,
    );
    expect(res.status).toBe(200);
  });
});

describe("GET /orders", () => {
  test("SUPER_ADMIN can list orders", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(
      "/orders",
      { headers: authHeaders("neon-super-admin") },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { orders: unknown[] } };
    expect(body.success).toBe(true);
    expect(body.data.orders).toHaveLength(1);
  });

  test("MANAGER can list orders", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(
      "/orders",
      { headers: authHeaders("neon-manager") },
      env,
    );
    expect(res.status).toBe(200);
  });

  test("ACCOUNTANT can list orders", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(
      "/orders",
      { headers: authHeaders("neon-accountant") },
      env,
    );
    expect(res.status).toBe(200);
  });
});

describe("GET /orders/:id", () => {
  test("SUPER_ADMIN can get order detail with items", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(
      `/orders/${ORDER_ID}`,
      { headers: authHeaders("neon-super-admin") },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as {
      success: boolean;
      data: { order: { items: Array<{ productId: string | null }> } };
    };
    expect(body.success).toBe(true);
    expect(body.data.order.items).toHaveLength(1);
    const oilLine = body.data.order.items.find((i) => i.productId);
    expect(oilLine?.productId).toBe(PRODUCT_ID);
  });

  test("MANAGER can get order detail", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(
      `/orders/${ORDER_ID}`,
      { headers: authHeaders("neon-manager") },
      env,
    );
    expect(res.status).toBe(200);
  });

  test("ACCOUNTANT can get order detail", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(
      `/orders/${ORDER_ID}`,
      { headers: authHeaders("neon-accountant") },
      env,
    );
    expect(res.status).toBe(200);
  });

  test("Returns 404 for non-existent order", async () => {
    const { default: app } = await import("../index");
    const nonExistentId = "00000000-0000-4000-8000-000000009999";
    const res = await app.request(
      `/orders/${nonExistentId}`,
      { headers: authHeaders("neon-super-admin") },
      env,
    );
    expect(res.status).toBe(404);
  });

  test("Returns 404 (not 500) for a non-UUID id — e.g. a removed /orders/parts path", async () => {
    const { default: app } = await import("../index");
    // Old mobile clients call /orders/parts and /orders/bearings, which don't
    // exist here (SA is oils-only) and fall through to /orders/:id. The id guard
    // must 404 them instead of letting "parts" hit a ::uuid cast and 500.
    for (const stray of ["parts", "bearings"]) {
      const res = await app.request(
        `/orders/${stray}`,
        { headers: authHeaders("neon-super-admin") },
        env,
      );
      expect(res.status).toBe(404);
    }
  });
});

describe("POST /orders", () => {
  const validPayload = {
    customerId: CUSTOMER_ID,
    items: [
      {
        productId: PRODUCT_ID,
        quantityUnits: 10,
        packSizeLitres: 1,
        estimatedUnitPrice: 420,
      },
    ],
    discountAmount: 0,
    deliveryAddress: null,
    deliveryNotes: null,
    remarks: null,
  };

  test("SUPER_ADMIN can create an order", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(
      "/orders",
      {
        method: "POST",
        headers: { ...authHeaders("neon-super-admin"), "Content-Type": "application/json" },
        body: JSON.stringify(validPayload),
      },
      env,
    );
    expect(res.status).toBe(201);
    const body = await res.json() as { success: boolean; data: { order: unknown } };
    expect(body.success).toBe(true);
    expect(body.data.order).toBeDefined();
  });

  test("MANAGER can create an order", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(
      "/orders",
      {
        method: "POST",
        headers: { ...authHeaders("neon-manager"), "Content-Type": "application/json" },
        body: JSON.stringify(validPayload),
      },
      env,
    );
    expect(res.status).toBe(201);
  });

  test("creates an order line for a quantity-unit product (no pack size)", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(
      "/orders",
      {
        method: "POST",
        headers: { ...authHeaders("neon-super-admin"), "Content-Type": "application/json" },
        body: JSON.stringify({
          ...validPayload,
          items: [{ productId: QTY_PRODUCT_ID, quantityUnits: 3, segment: "Car" }],
        }),
      },
      env,
    );
    expect(res.status).toBe(201);
  });

  test("rejects a litres product line missing a pack size", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(
      "/orders",
      {
        method: "POST",
        headers: { ...authHeaders("neon-super-admin"), "Content-Type": "application/json" },
        body: JSON.stringify({
          ...validPayload,
          items: [{ productId: PRODUCT_ID, quantityUnits: 3 }],
        }),
      },
      env,
    );
    expect(res.status).toBe(422);
  });

  test("ACCOUNTANT cannot create an order", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(
      "/orders",
      {
        method: "POST",
        headers: { ...authHeaders("neon-accountant"), "Content-Type": "application/json" },
        body: JSON.stringify(validPayload),
      },
      env,
    );
    expect(res.status).toBe(403);
  });

  test("Returns 422 if items array is empty", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(
      "/orders",
      {
        method: "POST",
        headers: { ...authHeaders("neon-super-admin"), "Content-Type": "application/json" },
        body: JSON.stringify({ ...validPayload, items: [] }),
      },
      env,
    );
    expect(res.status).toBe(422);
  });

  test("Returns 422 if customerId is missing", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(
      "/orders",
      {
        method: "POST",
        headers: { ...authHeaders("neon-super-admin"), "Content-Type": "application/json" },
        body: JSON.stringify({ ...validPayload, customerId: undefined }),
      },
      env,
    );
    expect(res.status).toBe(422);
  });
});

describe("POST /orders item validation", () => {
  async function postOrder(items: unknown[]) {
    const { default: app } = await import("../index");
    return app.request(
      "/orders",
      {
        method: "POST",
        headers: { ...authHeaders("neon-super-admin"), "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: CUSTOMER_ID, items }),
      },
      env,
    );
  }

  test("Rejects an item with no productId", async () => {
    const res = await postOrder([{ quantityUnits: 10 }]);
    expect(res.status).toBe(422);
  });
});
