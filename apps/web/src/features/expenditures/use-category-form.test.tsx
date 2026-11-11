import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FormEvent } from "react";

const apiRequest = vi.fn();
const invalidateQueries = vi.fn();
vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...actual, apiRequest: (...a: unknown[]) => apiRequest(...a) };
});
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries }) }));

import { useCategoryForm } from "./use-category-form";

const config = { apiBaseUrl: "", authToken: "" };
const onOpenChange = vi.fn();
const submit = () => ({ preventDefault: vi.fn() }) as unknown as FormEvent<HTMLFormElement>;
const setup = () => renderHook(() => useCategoryForm(config, onOpenChange));

beforeEach(() => { vi.clearAllMocks(); apiRequest.mockResolvedValue({}); });
afterEach(() => vi.restoreAllMocks());

describe("useCategoryForm", () => {
  it("defaults to variable and POSTs the trimmed name + type, then closes", async () => {
    const { result } = setup();
    expect(result.current.type).toBe("variable");
    act(() => { result.current.setName("  Security Guard "); result.current.setType("compulsory"); });
    await act(async () => result.current.handleSubmit(submit()));
    expect(apiRequest).toHaveBeenCalledWith(config, "POST", "/expenditures/categories", { name: "Security Guard", type: "compulsory" });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["expenditure-categories"] });
    expect(result.current.name).toBe(""); // reset
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("surfaces an error and stays open", async () => {
    apiRequest.mockRejectedValueOnce(new Error("Duplicate category"));
    const { result } = setup();
    act(() => result.current.setName("Rent"));
    await act(async () => result.current.handleSubmit(submit()));
    await waitFor(() => expect(result.current.error).toBe("Duplicate category"));
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
