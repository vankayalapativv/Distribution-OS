import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const apiRequest = vi.fn();
vi.mock("@/lib/api-client", () => ({
  apiRequest: (...a: unknown[]) => apiRequest(...a),
  errorMessage: (_e: unknown, fallback: string) => fallback,
}));

import { useCollectionDetail } from "./use-collection-detail";
import { collectionDetail } from "./collection-detail-fixture";

const config = { apiBaseUrl: "http://api", authToken: "tok" };

describe("useCollectionDetail", () => {
  it("derives isPending from the status", () => {
    const { result } = renderHook(() => useCollectionDetail(collectionDetail({ accountantApprovalStatus: "pending" }), config));
    expect(result.current.isPending).toBe(true);
  });

  it("verifies and replaces the collection with the enriched response", async () => {
    apiRequest.mockResolvedValueOnce(collectionDetail({ accountantApprovalStatus: "verified", approvedByAccountantName: "Anil" }));
    const { result } = renderHook(() => useCollectionDetail(collectionDetail(), config));
    await act(async () => result.current.handleVerify());
    await waitFor(() => expect(result.current.collection.accountantApprovalStatus).toBe("verified"));
    expect(apiRequest).toHaveBeenCalledWith(config, "POST", "/collections/c1/verify");
    expect(result.current.isVerifying).toBe(false);
  });

  it("surfaces a verify failure as an error", async () => {
    apiRequest.mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() => useCollectionDetail(collectionDetail(), config));
    await act(async () => result.current.handleVerify());
    await waitFor(() => expect(result.current.verifyError).toBe("Failed to verify."));
  });
});
