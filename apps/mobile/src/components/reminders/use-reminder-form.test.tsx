import { beforeEach, describe, expect, it, vi } from "vitest";

const params = vi.hoisted(() => ({ value: {} as { id?: string } }));
vi.mock("expo-router", () => ({ useLocalSearchParams: () => params.value }));

vi.mock("../../lib/auth", () => ({
  useAuth: (sel?: (s: { token: string }) => unknown) => (sel ? sel({ token: "t" }) : { token: "t" }),
}));

const fetchSeCustomers = vi.fn<(...a: unknown[]) => Promise<unknown>>();
vi.mock("../../lib/customer-directory", () => ({ fetchSeCustomers: (...a: unknown[]) => fetchSeCustomers(...a) }));

const getLocalDb = vi.fn<() => unknown>(() => ({}));
const getReminderById = vi.fn<(...a: unknown[]) => unknown>();
vi.mock("../../lib/db", () => ({ getLocalDb: () => getLocalDb() }));
vi.mock("../../lib/reminders", () => ({ getReminderById: (...a: unknown[]) => getReminderById(...a) }));

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useReminderForm } from "./use-reminder-form";

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(
    QueryClientProvider,
    { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
    children,
  );

beforeEach(() => {
  params.value = {};
  fetchSeCustomers.mockReset().mockResolvedValue([
    { id: "c1", name: "Acme Traders", code: "AC", address: "MG Road", phone: null, city: null },
    { id: "c2", name: "Beta", code: null, address: null, phone: null, city: null },
  ]);
  getLocalDb.mockReturnValue({});
  getReminderById.mockReset();
});

describe("useReminderForm", () => {
  it("defaults a new form and filters customers by the search term", async () => {
    const { result } = renderHook(() => useReminderForm(), { wrapper });
    expect(result.current.editId).toBeNull();
    expect(result.current.filteredCustomers).toEqual([]); // empty search → no results
    expect(result.current.whenLabel).toMatch(/·/);
    await waitFor(() => expect(result.current.customersQuery.data).toHaveLength(2));
    act(() => result.current.setCustomerSearch("mg")); // matches by address
    await waitFor(() => expect(result.current.filteredCustomers.map((c) => c.id)).toEqual(["c1"]));
  });

  it("prefills from the local DB in edit mode", async () => {
    params.value = { id: "5" };
    getReminderById.mockReturnValue({ id: 5, title: "Follow up", remindAt: Date.now() + 10_000, customerId: "c9", customerName: "Zed" });
    const { result } = renderHook(() => useReminderForm(), { wrapper });
    await waitFor(() => expect(result.current.title).toBe("Follow up"));
    expect(result.current.editId).toBe(5);
    expect(result.current.customer?.id).toBe("c9");
  });

  it("prefills a reminder without a customer", async () => {
    params.value = { id: "6" };
    getReminderById.mockReturnValue({ id: 6, title: "No cust", remindAt: Date.now() + 10_000, customerId: null, customerName: null });
    const { result } = renderHook(() => useReminderForm(), { wrapper });
    await waitFor(() => expect(result.current.title).toBe("No cust"));
    expect(result.current.customer).toBeNull();
  });

  it("defaults a blank customer name when the saved reminder has none", async () => {
    params.value = { id: "9" };
    getReminderById.mockReturnValue({ id: 9, title: "Nameless", remindAt: Date.now() + 10_000, customerId: "c9", customerName: null });
    const { result } = renderHook(() => useReminderForm(), { wrapper });
    await waitFor(() => expect(result.current.customer?.id).toBe("c9"));
    expect(result.current.customer?.name).toBe("");
  });

  it("tolerates a missing reminder in edit mode", async () => {
    params.value = { id: "7" };
    getReminderById.mockReturnValue(undefined); // not found → no prefill
    const { result } = renderHook(() => useReminderForm(), { wrapper });
    await waitFor(() => expect(result.current.editId).toBe(7));
    expect(result.current.title).toBe("");
  });

  it("does not prefill when the local DB is unavailable", async () => {
    params.value = { id: "8" };
    getLocalDb.mockReturnValue(null);
    const { result } = renderHook(() => useReminderForm(), { wrapper });
    await waitFor(() => expect(result.current.customersQuery).toBeDefined());
    expect(result.current.title).toBe("");
  });
});
