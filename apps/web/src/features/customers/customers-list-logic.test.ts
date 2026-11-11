import { describe, expect, it, vi } from "vitest";
import {
  buildDownloadParams,
  buildFilterCaption,
  collectAllCustomers,
  type CustomerFilters,
} from "./customers-list-logic";
import type { Customer } from "./customers-api";

const empty: CustomerFilters = { search: "", city: "", salesExecutiveId: "", dues: "" };
const execs = [{ id: "u1", name: "Ravi" }];

describe("buildFilterCaption", () => {
  it("summarises every active filter", () => {
    expect(
      buildFilterCaption({ search: "raj", city: "Hyd", salesExecutiveId: "u1", dues: "owes" }, execs),
    ).toBe('Filters — Search: "raj" · City: Hyd · Executive: Ravi · Dues: Owes');
  });
  it("falls back to the executive id + raw dues when unknown", () => {
    expect(buildFilterCaption({ ...empty, salesExecutiveId: "zzz", dues: "weird" }, execs)).toBe(
      "Filters — Executive: zzz · Dues: weird",
    );
  });
  it("says 'All customers' with no filters", () => {
    expect(buildFilterCaption(empty, execs)).toBe("All customers");
  });
});

describe("buildDownloadParams", () => {
  it("includes filters + sort and caps pageSize at 100", () => {
    const sp = buildDownloadParams(
      { search: "raj", city: "Hyd", salesExecutiveId: "u1", dues: "owes" },
      { id: "legalName", desc: true },
    );
    expect(sp.get("search")).toBe("raj");
    expect(sp.get("city")).toBe("Hyd");
    expect(sp.get("salesExecutiveId")).toBe("u1");
    expect(sp.get("dues")).toBe("owes");
    expect(sp.get("sort")).toBe("legalName");
    expect(sp.get("dir")).toBe("desc");
    expect(sp.get("pageSize")).toBe("100");
  });
  it("omits sort when none is given and uses asc for desc:false", () => {
    expect(buildDownloadParams(empty, undefined).get("sort")).toBeNull();
    expect(buildDownloadParams(empty, { id: "x", desc: false }).get("dir")).toBe("asc");
  });
});

describe("collectAllCustomers", () => {
  const row = (id: string) => ({ id }) as unknown as Customer;

  it("pages until every row is gathered", async () => {
    const fetchPage = vi.fn(async (page: number) =>
      page === 1
        ? { customers: [row("a"), row("b")], total: 3 }
        : { customers: [row("c")], total: 3 },
    );
    const all = await collectAllCustomers(fetchPage);
    expect(all.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("stops on an empty page even if total is not reached", async () => {
    const fetchPage = vi.fn(async () => ({ customers: [], total: 99 }));
    expect(await collectAllCustomers(fetchPage)).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});
