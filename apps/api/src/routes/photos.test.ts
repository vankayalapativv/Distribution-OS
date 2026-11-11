import { beforeEach, describe, expect, test, vi } from "vitest";
import { authHeaders, authTestEnv, installAuthFetchMock } from "../test/auth";

const SE_ID = "00000000-0000-4000-8000-000000000004";
const CUSTOMER_ID = "00000000-0000-4000-8000-000000000501";
const PHOTO_ID = "00000000-0000-4000-8000-000000000f01";
// A photo on a customer created by a different SE.
const FOREIGN_PHOTO_ID = "00000000-0000-4000-8000-000000000f02";
const OTHER_SE_ID = "00000000-0000-4000-8000-000000000005";

const queryLog: string[] = [];

vi.mock("@neondatabase/serverless", () => ({
  neon: () => async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join(" ");
    const tag = query.match(/\/\*\s*([a-z0-9_]+)\s*\*\//i);
    if (tag) queryLog.push(tag[1]);

    if (query.includes("auth_app_profile")) {
      const subject = values[0] as string;
      if (subject === "neon-manager") {
        return [{ role: "MANAGER", userId: "00000000-0000-4000-8000-000000000002" , enterpriseId: "00000000-0000-4000-8000-0000000000e1"}];
      }
      return [{ role: "SALES_EXECUTIVE", userId: SE_ID , enterpriseId: "00000000-0000-4000-8000-0000000000e1"}];
    }
    if (query.includes("assert_customer_visible")) {
      return values.includes(CUSTOMER_ID) ? [{ id: CUSTOMER_ID }] : [];
    }
    if (query.includes("get_photo_for_delete")) {
      if (values.includes(PHOTO_ID)) {
        return [{ id: PHOTO_ID, fileKey: "customers/x/y.jpg", customerCreatedBy: SE_ID }];
      }
      if (values.includes(FOREIGN_PHOTO_ID)) {
        return [
          { id: FOREIGN_PHOTO_ID, fileKey: "customers/z/w.jpg", customerCreatedBy: OTHER_SE_ID },
        ];
      }
      return [];
    }
    if (query.includes("delete_customer_photo")) {
      return [];
    }
    if (query.includes("create_customer_photo")) {
      return [
        {
          id: PHOTO_ID,
          customerId: CUSTOMER_ID,
          fileKey: "customers/x/y.jpg",
          contentType: "image/jpeg",
          createdAt: "2026-07-10T10:00:00.000Z",
        },
      ];
    }
    if (query.includes("list_customer_photos")) {
      return [
        {
          id: PHOTO_ID,
          contentType: "image/jpeg",
          createdAt: "2026-07-10T10:00:00.000Z",
        },
      ];
    }
    if (query.includes("get_photo_by_id")) {
      // The stream is now SE-scoped (joins customers → created_by), like delete.
      if (values.includes(PHOTO_ID)) {
        return [{ id: PHOTO_ID, fileKey: "customers/x/y.jpg", contentType: "image/jpeg", customerCreatedBy: SE_ID }];
      }
      if (values.includes(FOREIGN_PHOTO_ID)) {
        return [{ id: FOREIGN_PHOTO_ID, fileKey: "customers/z/w.jpg", contentType: "image/jpeg", customerCreatedBy: OTHER_SE_ID }];
      }
      return [];
    }
    return [];
  },
}));

// Minimal R2 mock
const r2Store = new Map<string, ArrayBuffer>();
const PHOTOS = {
  put: vi.fn(async (key: string, value: ArrayBuffer) => {
    r2Store.set(key, value);
    return {};
  }),
  get: vi.fn(async (key: string) => {
    const body = r2Store.get(key);
    if (!body) return null;
    return { body: new Blob([body]).stream(), httpMetadata: {} };
  }),
  delete: vi.fn(async (key: string) => {
    r2Store.delete(key);
  }),
};

const env = {
  DATABASE_URL: "postgresql://example.test/db",
  PHOTOS,
  ...authTestEnv,
};

function jpeg(): File {
  return new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], "shop.jpg", {
    type: "image/jpeg",
  });
}

describe("customer photos (market intelligence)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(installAuthFetchMock()));
    queryLog.length = 0;
    r2Store.clear();
    PHOTOS.put.mockClear();
    PHOTOS.get.mockClear();
    PHOTOS.delete.mockClear();
  });

  test("SE uploads a photo → 201, stored in R2 and recorded", async () => {
    const { default: app } = await import("../index");

    const form = new FormData();
    form.append("photo", jpeg());

    const res = await app.request(
      `/api/v1/customers/${CUSTOMER_ID}/photos`,
      { method: "POST", headers: authHeaders("neon-se"), body: form },
      env,
    );

    expect(res.status).toBe(201);
    expect(PHOTOS.put).toHaveBeenCalledTimes(1);
    expect(queryLog).toContain("create_customer_photo");
    const body = await res.json();
    expect(body.data.id).toBe(PHOTO_ID);
  });

  test("upload without a file → 422", async () => {
    const { default: app } = await import("../index");

    const form = new FormData();
    const res = await app.request(
      `/api/v1/customers/${CUSTOMER_ID}/photos`,
      { method: "POST", headers: authHeaders("neon-se"), body: form },
      env,
    );

    expect(res.status).toBe(422);
    expect(PHOTOS.put).not.toHaveBeenCalled();
  });

  test("upload to unknown customer → 404", async () => {
    const { default: app } = await import("../index");

    const form = new FormData();
    form.append("photo", jpeg());
    const res = await app.request(
      "/api/v1/customers/00000000-0000-4000-8000-000000000599/photos",
      { method: "POST", headers: authHeaders("neon-se"), body: form },
      env,
    );

    expect(res.status).toBe(404);
  });

  test("lists a customer's photos", async () => {
    const { default: app } = await import("../index");

    const res = await app.request(
      `/api/v1/customers/${CUSTOMER_ID}/photos`,
      { headers: authHeaders("neon-se") },
      env,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.photos).toHaveLength(1);
    expect(body.data.photos[0].id).toBe(PHOTO_ID);
  });

  test("streams the photo binary by id", async () => {
    const { default: app } = await import("../index");

    // seed R2
    await PHOTOS.put("customers/x/y.jpg", new Uint8Array([0xff, 0xd8]).buffer);

    const res = await app.request(
      `/api/v1/photos/${PHOTO_ID}`,
      { headers: authHeaders("neon-se") },
      env,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
  });

  test("SE streaming a FOREIGN customer's photo → 404 (IDOR fix)", async () => {
    const { default: app } = await import("../index");
    await PHOTOS.put("customers/z/w.jpg", new Uint8Array([0xff, 0xd8]).buffer);
    const res = await app.request(
      `/api/v1/photos/${FOREIGN_PHOTO_ID}`,
      { headers: authHeaders("neon-se") },
      env,
    );
    expect(res.status).toBe(404);
  });

  test("unknown photo id → 404", async () => {
    const { default: app } = await import("../index");

    const res = await app.request(
      "/api/v1/photos/00000000-0000-4000-8000-000000000f99",
      { headers: authHeaders("neon-se") },
      env,
    );

    expect(res.status).toBe(404);
  });

  test("MANAGER can delete a photo (removes from R2 and DB)", async () => {
    const { default: app } = await import("../index");

    const res = await app.request(
      `/api/v1/photos/${PHOTO_ID}`,
      { method: "DELETE", headers: authHeaders("neon-manager") },
      env,
    );

    expect(res.status).toBe(200);
    expect(PHOTOS.delete).toHaveBeenCalledWith("customers/x/y.jpg");
  });

  test("SE can delete a photo on a customer they created", async () => {
    const { default: app } = await import("../index");

    const res = await app.request(
      `/api/v1/photos/${PHOTO_ID}`,
      { method: "DELETE", headers: authHeaders("neon-se") },
      env,
    );

    expect(res.status).toBe(200);
    expect(PHOTOS.delete).toHaveBeenCalledWith("customers/x/y.jpg");
  });

  test("SE deleting a photo on another SE's customer → 404", async () => {
    const { default: app } = await import("../index");

    const res = await app.request(
      `/api/v1/photos/${FOREIGN_PHOTO_ID}`,
      { method: "DELETE", headers: authHeaders("neon-se") },
      env,
    );

    expect(res.status).toBe(404);
    expect(PHOTOS.delete).not.toHaveBeenCalled();
  });

  test("upload with category=customer records the category", async () => {
    const { default: app } = await import("../index");

    const form = new FormData();
    form.append("photo", jpeg());
    form.append("category", "customer");

    const res = await app.request(
      `/api/v1/customers/${CUSTOMER_ID}/photos`,
      { method: "POST", headers: authHeaders("neon-se"), body: form },
      env,
    );

    expect(res.status).toBe(201);
  });

  test("upload with a bogus category → 422", async () => {
    const { default: app } = await import("../index");

    const form = new FormData();
    form.append("photo", jpeg());
    form.append("category", "selfies");

    const res = await app.request(
      `/api/v1/customers/${CUSTOMER_ID}/photos`,
      { method: "POST", headers: authHeaders("neon-se"), body: form },
      env,
    );

    expect(res.status).toBe(422);
    expect(PHOTOS.put).not.toHaveBeenCalled();
  });

  test("unauthenticated upload → 401", async () => {
    const { default: app } = await import("../index");

    const form = new FormData();
    form.append("photo", jpeg());
    const res = await app.request(
      `/api/v1/customers/${CUSTOMER_ID}/photos`,
      { method: "POST", body: form },
      env,
    );

    expect(res.status).toBe(401);
  });
});
