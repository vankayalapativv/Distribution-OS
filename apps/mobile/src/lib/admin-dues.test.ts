import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchAdminDuesCustomers,
  fetchAdminDuesSummary,
  fetchDuesByExecutive,
  fetchSalesExecutives,
} from "./admin-dues";

const apiFetch = vi.fn();
vi.mock("./api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("./auth", () => ({ useAuth: { getState: () => ({ token: "tok" }) } }));

afterEach(() => vi.clearAllMocks());

describe("fetchDuesByExecutive", () => {
  it("unwraps the executives list", async () => {
    const execs = [{ executiveId: "e1", executiveName: "A", customerCount: 3, totalOutstanding: 100 }];
    apiFetch.mockResolvedValue({ executives: execs });
    await expect(fetchDuesByExecutive()).resolves.toEqual(execs);
    expect(apiFetch).toHaveBeenCalledWith("/dues/by-executive", { token: "tok" });
  });
  it("defaults to an empty list when the field is missing", async () => {
    apiFetch.mockResolvedValue({});
    await expect(fetchDuesByExecutive()).resolves.toEqual([]);
  });
});

describe("fetchAdminDuesSummary", () => {
  it("scopes to one executive when given an id", async () => {
    apiFetch.mockResolvedValue({ buckets: [] });
    await fetchAdminDuesSummary("e1");
    expect(apiFetch).toHaveBeenCalledWith("/dues/summary?executiveId=e1", { token: "tok" });
  });
  it("queries all executives when none is given", async () => {
    apiFetch.mockResolvedValue({ buckets: [] });
    await fetchAdminDuesSummary();
    expect(apiFetch).toHaveBeenCalledWith("/dues/summary", { token: "tok" });
    await fetchAdminDuesSummary(null);
    expect(apiFetch).toHaveBeenCalledWith("/dues/summary", { token: "tok" });
  });
});

describe("fetchAdminDuesCustomers", () => {
  it("appends the executive filter when scoped", async () => {
    apiFetch.mockResolvedValue({ bucket: "1", customers: [] });
    await fetchAdminDuesCustomers("1", "e1");
    expect(apiFetch).toHaveBeenCalledWith("/dues/customers?bucket=1&executiveId=e1", { token: "tok" });
  });
  it("omits the filter for all executives", async () => {
    apiFetch.mockResolvedValue({ bucket: "1", customers: [] });
    await fetchAdminDuesCustomers("1");
    expect(apiFetch).toHaveBeenCalledWith("/dues/customers?bucket=1", { token: "tok" });
  });
});

describe("fetchSalesExecutives", () => {
  it("unwraps the sales executives", async () => {
    const list = [{ id: "e1", name: "A" }];
    apiFetch.mockResolvedValue({ salesExecutives: list });
    await expect(fetchSalesExecutives()).resolves.toEqual(list);
    expect(apiFetch).toHaveBeenCalledWith("/orders/sales-executives", { token: "tok" });
  });
  it("defaults to an empty list when the field is missing", async () => {
    apiFetch.mockResolvedValue({});
    await expect(fetchSalesExecutives()).resolves.toEqual([]);
  });
});
