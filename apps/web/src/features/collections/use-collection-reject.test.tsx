import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiRequest = vi.fn();
vi.mock("@/lib/api-client", () => ({
  apiRequest: (...a: unknown[]) => apiRequest(...a),
  errorMessage: (_e: unknown, fallback: string) => fallback,
}));
const draftClear = vi.fn();
vi.mock("@/components/form/use-form-draft", () => ({
  readDraft: () => "",
  useFormDraft: () => ({ clear: draftClear }),
}));

import { useCollectionReject } from "./use-collection-reject";
import { collectionDetail } from "./collection-detail-fixture";

const config = { apiBaseUrl: "http://api", authToken: "tok" };
const setup = (onRejected = vi.fn(), onDone = vi.fn()) =>
  renderHook(() => useCollectionReject({ open: true, collection: collectionDetail(), actionConfig: config, onRejected, onDone }));

afterEach(() => { apiRequest.mockReset(); draftClear.mockReset(); });

describe("useCollectionReject", () => {
  it("does nothing when the reason is blank", async () => {
    const { result } = setup();
    await act(async () => result.current.handleReject());
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("rejects with the trimmed reason and closes on success", async () => {
    apiRequest.mockResolvedValueOnce(collectionDetail({ accountantApprovalStatus: "rejected" }));
    const onRejected = vi.fn();
    const onDone = vi.fn();
    const { result } = setup(onRejected, onDone);
    act(() => result.current.setRemark("  cheque bounced  "));
    await act(async () => result.current.handleReject());
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(apiRequest).toHaveBeenCalledWith(config, "POST", "/collections/c1/reject", { remark: "cheque bounced" });
    expect(onRejected).toHaveBeenCalled();
    expect(draftClear).toHaveBeenCalled();
  });

  it("surfaces a rejection failure", async () => {
    apiRequest.mockRejectedValueOnce(new Error("x"));
    const { result } = setup();
    act(() => result.current.setRemark("bad"));
    await act(async () => result.current.handleReject());
    await waitFor(() => expect(result.current.rejectError).toBe("Failed to reject."));
  });
});
