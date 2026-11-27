import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchClaimCategories,
  fetchMyClaims,
  resubmitClaim,
  submitExpenseClaim,
} from "./expense-claims";

const apiFetch = vi.fn();
const postPhotoUpload = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
vi.mock("./api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a), API_BASE_URL: "http://x/api/v1" }));
vi.mock("./photo-upload-post", () => ({ postPhotoUpload: (...a: unknown[]) => postPhotoUpload(...a) }));
// expo-file-system File must be a Blob subclass so node's FormData.append accepts it.
vi.mock("expo-file-system", () => ({ File: class extends Blob { constructor(uri: string) { super([uri]); } } }));

afterEach(() => vi.clearAllMocks());

describe("fetch helpers", () => {
  it("GETs categories and my claims with the token", async () => {
    apiFetch.mockResolvedValue([]);
    await fetchClaimCategories("tok");
    expect(apiFetch).toHaveBeenCalledWith("/expense-claims/categories", { token: "tok" });
    await fetchMyClaims("tok");
    expect(apiFetch).toHaveBeenCalledWith("/expense-claims/mine", { token: "tok" });
  });
});

describe("submitExpenseClaim", () => {
  it("POSTs a multipart claim with the receipt + fields", async () => {
    await submitExpenseClaim(
      { categoryId: "c1", amount: 450, expenditureDate: "2026-11-28", remarks: "toll", receiptUri: "file:///r.jpg", clientUuid: "u1" },
      "tok",
    );
    const [url, headers, form] = postPhotoUpload.mock.calls[0] as [string, Record<string, string>, FormData];
    expect(url).toBe("http://x/api/v1/expense-claims");
    expect(headers).toEqual({ Authorization: "Bearer tok" });
    expect(form.get("categoryId")).toBe("c1");
    expect(form.get("amount")).toBe("450");
    expect(form.get("expenditureDate")).toBe("2026-11-28");
    expect(form.get("remarks")).toBe("toll");
    expect(form.get("clientUuid")).toBe("u1");
    expect(form.get("file")).toBeInstanceOf(Blob);
  });

  it("omits optional fields and sends no auth header without a token", async () => {
    await submitExpenseClaim({ categoryId: "c1", amount: 10, expenditureDate: "2026-11-28", receiptUri: "file:///photo/scan" }, null);
    const [, headers, form] = postPhotoUpload.mock.calls[0] as [string, undefined, FormData];
    expect(headers).toBeUndefined();
    expect(form.get("remarks")).toBeNull();
    expect(form.get("clientUuid")).toBeNull();
  });

  it("falls back to a default receipt filename", async () => {
    await submitExpenseClaim({ categoryId: "c1", amount: 10, expenditureDate: "2026-11-28", receiptUri: "" }, "tok");
    expect(postPhotoUpload).toHaveBeenCalled();
  });
});

describe("resubmitClaim", () => {
  it("POSTs the edited fields to the resubmit route", async () => {
    apiFetch.mockResolvedValue({ id: "r1" });
    await resubmitClaim("r1", { categoryId: "c2", amount: 99, expenditureDate: "2026-11-28", remarks: null }, "tok");
    expect(apiFetch).toHaveBeenCalledWith("/expense-claims/r1/resubmit", {
      method: "POST",
      token: "tok",
      body: { categoryId: "c2", amount: 99, expenditureDate: "2026-11-28", remarks: null },
    });
  });
});
