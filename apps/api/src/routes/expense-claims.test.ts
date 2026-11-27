import { beforeEach, describe, expect, test, vi } from "vitest";
import { authHeaders, authTestEnv, installAuthFetchMock } from "../test/auth";

const SUPER_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const MANAGER_ID = "00000000-0000-4000-8000-000000000002";
const ACCOUNTANT_ID = "00000000-0000-4000-8000-000000000003";
const SE_ID = "00000000-0000-4000-8000-000000000004";
const CATEGORY_ID = "00000000-0000-4000-8000-000000000a01";
const CLAIM_ID = "00000000-0000-4000-8000-000000000b01";
const OTHER_ID = "00000000-0000-4000-8000-000000000b02";
const REJECTED_ID = "00000000-0000-4000-8000-000000000b03";
const ENT = "00000000-0000-4000-8000-0000000000e1";

/** A claim row (CLAIM_COLUMNS) whose owner + status depend on the id looked up. */
function claimRow(id: unknown) {
  return {
    id, code: "EXP-0007", date: "2026-11-28", categoryId: CATEGORY_ID,
    categoryName: "Fuel — Sales Executives", amount: "450", claimedAmount: "450",
    status: id === REJECTED_ID ? "rejected" : "submitted",
    remarks: null, rejectReason: null, billFileKey: "expenditures/x/r.jpg",
    submittedBy: id === OTHER_ID ? "99999999-9999-4999-8999-999999999999" : SE_ID,
    submitterName: "Priya Field SE", approvedAt: null, createdAt: "2026-11-28T04:00:00.000Z",
  };
}

vi.mock("@neondatabase/serverless", () => {
  const handler = async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join(" ");
    if (query.includes("auth_app_profile")) {
      const role: Record<string, string> = {
        "neon-super-admin": "SUPER_ADMIN", "neon-manager": "MANAGER",
        "neon-accountant": "ACCOUNTANT", "neon-se": "SALES_EXECUTIVE",
      };
      const uid: Record<string, string> = {
        "neon-super-admin": SUPER_ADMIN_ID, "neon-manager": MANAGER_ID,
        "neon-accountant": ACCOUNTANT_ID, "neon-se": SE_ID,
      };
      const s = values[0] as string;
      return [{ role: role[s], userId: uid[s] ?? SUPER_ADMIN_ID, enterpriseId: ENT }];
    }
    if (query.includes("role_permission_overrides")) return []; // catalog defaults
    if (query.includes("claim_categories")) return [{ id: CATEGORY_ID, name: "Fuel — Sales Executives" }];
    if (query.includes("claim_category_check")) return [{ type: "variable" }];
    if (query.includes("claim_idempotency")) return [];
    if (query.includes("next_claim_code")) return [{ seq: 7 }];
    if (query.includes("submit_claim")) return [{ id: CLAIM_ID }];
    if (query.includes("expenditure_for_bill")) return [{ id: CLAIM_ID, billFileKey: null }];
    if (query.includes("get_expenditure_bill")) return [{ fileKey: "expenditures/x/r.jpg", contentType: "image/jpeg" }];
    return [];
  };
  handler.query = async (text: string, params: unknown[]) => {
    if (text.includes("get_claim")) return [claimRow(params[0])];
    if (text.includes("list_claims")) return [claimRow(CLAIM_ID)];
    return [];
  };
  return { neon: () => handler };
});

const fakeBucket = {
  put: vi.fn().mockResolvedValue(undefined),
  get: vi.fn().mockResolvedValue({ body: new ReadableStream() }),
  delete: vi.fn().mockResolvedValue(undefined),
};
const env = { DATABASE_URL: "postgresql://example.test/db", PHOTOS: fakeBucket, ...authTestEnv };
const jsonHeaders = (s: string) => ({ "Content-Type": "application/json", ...authHeaders(s) });

function submitForm() {
  const fd = new FormData();
  fd.set("categoryId", CATEGORY_ID);
  fd.set("amount", "450");
  fd.set("expenditureDate", "2026-11-28");
  fd.set("file", new File([new Uint8Array([1, 2, 3, 4])], "r.jpg", { type: "image/jpeg" }));
  return fd;
}

describe("expense-claims routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(installAuthFetchMock()));
  });

  test("SE submits a claim with its receipt", async () => {
    const { default: app } = await import("../index");
    const res = await app.request("/api/v1/expense-claims", { method: "POST", headers: authHeaders("neon-se"), body: submitForm() }, env);
    expect(res.status).toBe(201);
    expect(fakeBucket.put).toHaveBeenCalled();
    expect((await res.json()).data).toMatchObject({ id: CLAIM_ID, status: "submitted" });
  });

  test("submit carries optional remarks + clientUuid", async () => {
    const { default: app } = await import("../index");
    const fd = submitForm();
    fd.set("remarks", "highway toll");
    fd.set("clientUuid", "11111111-1111-4111-8111-111111111111");
    const res = await app.request("/api/v1/expense-claims", { method: "POST", headers: authHeaders("neon-se"), body: fd }, env);
    expect(res.status).toBe(201);
  });

  test("resubmit with no amount is 422", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(`/api/v1/expense-claims/${REJECTED_ID}/resubmit`, { method: "POST", headers: jsonHeaders("neon-se"), body: JSON.stringify({ categoryId: CATEGORY_ID, expenditureDate: "2026-11-28" }) }, env);
    expect(res.status).toBe(422);
  });

  test("submitting without a receipt is 422", async () => {
    const { default: app } = await import("../index");
    const fd = submitForm(); fd.delete("file");
    const res = await app.request("/api/v1/expense-claims", { method: "POST", headers: authHeaders("neon-se"), body: fd }, env);
    expect(res.status).toBe(422);
  });

  test("an office role cannot submit (field-only)", async () => {
    const { default: app } = await import("../index");
    const res = await app.request("/api/v1/expense-claims", { method: "POST", headers: authHeaders("neon-manager"), body: submitForm() }, env);
    expect(res.status).toBe(403);
  });

  test("submit without storage configured is 500", async () => {
    const { default: app } = await import("../index");
    const res = await app.request("/api/v1/expense-claims", { method: "POST", headers: authHeaders("neon-se"), body: submitForm() }, { ...env, PHOTOS: undefined });
    expect(res.status).toBe(500);
  });

  test("SE lists claim categories; office is forbidden here", async () => {
    const { default: app } = await import("../index");
    const ok = await app.request("/api/v1/expense-claims/categories", { headers: authHeaders("neon-se") }, env);
    expect(ok.status).toBe(200);
    expect((await ok.json()).data).toEqual([{ id: CATEGORY_ID, name: "Fuel — Sales Executives" }]);
    const no = await app.request("/api/v1/expense-claims/categories", { headers: authHeaders("neon-manager") }, env);
    expect(no.status).toBe(403);
  });

  test("SE lists their own claims", async () => {
    const { default: app } = await import("../index");
    const res = await app.request("/api/v1/expense-claims/mine", { headers: authHeaders("neon-se") }, env);
    expect(res.status).toBe(200);
    expect((await res.json()).data).toHaveLength(1);
  });

  test("the office queue lists pending claims; SE is forbidden", async () => {
    const { default: app } = await import("../index");
    const ok = await app.request("/api/v1/expense-claims?status=submitted", { headers: authHeaders("neon-manager") }, env);
    expect(ok.status).toBe(200);
    const no = await app.request("/api/v1/expense-claims", { headers: authHeaders("neon-se") }, env);
    expect(no.status).toBe(403);
  });

  test("GET /:id — office any, owner own, non-owner 404", async () => {
    const { default: app } = await import("../index");
    expect((await app.request(`/api/v1/expense-claims/${CLAIM_ID}`, { headers: authHeaders("neon-accountant") }, env)).status).toBe(200);
    expect((await app.request(`/api/v1/expense-claims/${CLAIM_ID}`, { headers: authHeaders("neon-se") }, env)).status).toBe(200);
    expect((await app.request(`/api/v1/expense-claims/${OTHER_ID}`, { headers: authHeaders("neon-se") }, env)).status).toBe(404);
  });

  test("manager approves; SE is forbidden", async () => {
    const { default: app } = await import("../index");
    const ok = await app.request(`/api/v1/expense-claims/${CLAIM_ID}/approve`, { method: "POST", headers: jsonHeaders("neon-manager"), body: JSON.stringify({ approvedAmount: 400 }) }, env);
    expect(ok.status).toBe(200);
    const no = await app.request(`/api/v1/expense-claims/${CLAIM_ID}/approve`, { method: "POST", headers: jsonHeaders("neon-se"), body: "{}" }, env);
    expect(no.status).toBe(403);
  });

  test("approve with no body approves in full", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(`/api/v1/expense-claims/${CLAIM_ID}/approve`, { method: "POST", headers: authHeaders("neon-super-admin") }, env);
    expect(res.status).toBe(200);
  });

  test("approve tolerates a malformed JSON body", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(`/api/v1/expense-claims/${CLAIM_ID}/approve`, { method: "POST", headers: jsonHeaders("neon-manager"), body: "{not json" }, env);
    expect(res.status).toBe(200);
  });

  test("reject needs a reason", async () => {
    const { default: app } = await import("../index");
    const ok = await app.request(`/api/v1/expense-claims/${CLAIM_ID}/reject`, { method: "POST", headers: jsonHeaders("neon-manager"), body: JSON.stringify({ reason: "blurry bill" }) }, env);
    expect(ok.status).toBe(200);
    const bad = await app.request(`/api/v1/expense-claims/${CLAIM_ID}/reject`, { method: "POST", headers: jsonHeaders("neon-manager"), body: "{}" }, env);
    expect(bad.status).toBe(422);
  });

  test("SE resubmits a rejected claim", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(`/api/v1/expense-claims/${REJECTED_ID}/resubmit`, { method: "POST", headers: jsonHeaders("neon-se"), body: JSON.stringify({ categoryId: CATEGORY_ID, amount: 450, expenditureDate: "2026-11-28", remarks: "clearer bill" }) }, env);
    expect(res.status).toBe(200);
  });

  test("receipt streams for office; 404 for a non-owner field user", async () => {
    const { default: app } = await import("../index");
    const ok = await app.request(`/api/v1/expense-claims/${CLAIM_ID}/bill`, { headers: authHeaders("neon-manager") }, env);
    expect(ok.status).toBe(200);
    expect(fakeBucket.get).toHaveBeenCalled();
    const no = await app.request(`/api/v1/expense-claims/${OTHER_ID}/bill`, { headers: authHeaders("neon-se") }, env);
    expect(no.status).toBe(404);
  });
});
