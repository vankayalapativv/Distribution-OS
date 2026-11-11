import { describe, expect, it } from "vitest";
import {
  createCustomer,
  listCustomerFilterOptions,
  listCustomers,
  listCustomersPaged,
  updateCustomer,
  updateCustomerSeFields,
  updateCustomerStatus,
} from "./customers";
import { makeSql } from "../test/sql-mock";

const CTX = { userId: "u1", role: "SUPER_ADMIN" as const };
const CROW = { id: "c1", customerCode: "CUST-0001", legalName: "Ravi Motors", status: "active" };

describe("listCustomers", () => {
  it("runs with default (omitted) filters", async () => {
    const sql = makeSql({ list_customers: [CROW] });
    const rows = await listCustomers(sql, CTX);
    expect(rows[0]).toMatchObject({ id: "c1" });
  });
});

describe("listCustomersPaged", () => {
  it("binds the city and sales-executive filters", async () => {
    const sql = makeSql({ list_customers_paged_count: [{ total: 1 }], list_customers_paged: [CROW] });
    const res = await listCustomersPaged(sql, CTX, { city: "Hyderabad", salesExecutiveId: "se-1", page: 1, pageSize: 20 });
    expect(res.total).toBe(1);
    const countCall = sql.calls.find((c) => c.tag === "list_customers_paged_count")!;
    expect(countCall.params).toEqual(expect.arrayContaining(["Hyderabad", "se-1"]));
  });
});

describe("listCustomerFilterOptions", () => {
  it("returns non-blank cities + the SE roster", async () => {
    const sql = makeSql({
      customer_cities: [{ city: "Hyderabad" }, { city: "" }],
      customer_sales_executives: [{ id: "se-1", name: "Asha" }],
    });
    const out = await listCustomerFilterOptions(sql, "se-1");
    expect(out.cities).toEqual(["Hyderabad"]);
    expect(out.salesExecutives).toEqual([{ id: "se-1", name: "Asha" }]);
  });
});

describe("updateCustomerSeFields", () => {
  it("checks a changed phone, updates, and maps the row", async () => {
    const sql = makeSql({
      current_phone_for_edit: [{ norm: "9999999999" }],
      check_duplicate_phone: [], // available
      update_customer_se_fields: [CROW],
    });
    const res = await updateCustomerSeFields(sql, CTX, "c1", { phone: "8888888888", addressCity: "Hyd" });
    expect(res).toMatchObject({ id: "c1" });
  });

  it("rejects an invalid phone and a duplicate phone", async () => {
    const short = makeSql({ current_phone_for_edit: [{ norm: "9999999999" }] });
    await expect(updateCustomerSeFields(short, CTX, "c1", { phone: "123" })).rejects.toMatchObject({ status: 422 });
    const dup = makeSql({
      current_phone_for_edit: [{ norm: "9999999999" }],
      check_duplicate_phone: [{ customerCode: "CUST-0002", legalName: "Other" }],
    });
    await expect(updateCustomerSeFields(dup, CTX, "c1", { phone: "8888888888" })).rejects.toMatchObject({ status: 409 });
  });

  it("maps a unique-violation from the update to a 409", async () => {
    const sql = makeSql({
      update_customer_se_fields: () => {
        throw new Error("duplicate key value violates unique constraint");
      },
    });
    await expect(updateCustomerSeFields(sql, CTX, "c1", { addressCity: "Hyd" })).rejects.toMatchObject({ status: 409 });
  });

  it("rethrows a non-unique update error", async () => {
    const sql = makeSql({
      update_customer_se_fields: () => {
        throw new Error("db boom");
      },
    });
    await expect(updateCustomerSeFields(sql, CTX, "c1", { addressCity: "Hyd" })).rejects.toThrow("db boom");
  });

  it("404s when no row is updated", async () => {
    const sql = makeSql({ update_customer_se_fields: [] });
    await expect(updateCustomerSeFields(sql, CTX, "c1", { addressCity: "Hyd" })).rejects.toMatchObject({ status: 404 });
  });
});

const validInput = (over: Record<string, unknown> = {}) => ({
  legalName: "Ravi Motors",
  tradeName: null,
  customerName: null,
  customerType: "retail",
  segment: null,
  phone: "9876543210",
  alternativePhone: null,
  gstNumber: null,
  panNumber: null,
  aadharNumber: null,
  addressStreet: "Main Rd",
  addressCity: "Hyderabad",
  addressState: "Telangana",
  addressPincode: "500001",
  addressLandmark: null,
  email: null,
  customerGrade: null,
  creditLimit: 50000,
  creditDays: 30,
  salesExecutiveId: "se-1",
  ...over,
});

describe("createCustomer", () => {
  it("rejects an invalid customer type (422)", async () => {
    await expect(createCustomer(makeSql(), CTX, validInput({ customerType: "bogus" }) as never)).rejects.toMatchObject({ status: 422 });
  });

  it("requires the owner to be an active sales executive (422)", async () => {
    const sql = makeSql({ check_duplicate_phone: [], validate_owner_is_se: [] });
    await expect(createCustomer(sql, CTX, validInput() as never)).rejects.toMatchObject({ status: 422 });
  });

  it("recovers the winner on a concurrent client_uuid race, and rethrows other errors", async () => {
    let seen = 0;
    const sql = makeSql({
      get_customer_by_client_uuid: () => (seen++ === 0 ? [] : [CROW]),
      check_duplicate_phone: [],
      validate_owner_is_se: [{ ok: 1 }],
      next_customer_code: [{ next_seq: 1 }],
      create_customer: () => {
        throw Object.assign(new Error("dup"), { code: "23505", constraint: "customers_client_uuid_unique" });
      },
    });
    const res = await createCustomer(sql, CTX, validInput({ clientUuid: "u1" }) as never);
    expect(res).toMatchObject({ id: "c1" });

    const boom = makeSql({
      check_duplicate_phone: [],
      validate_owner_is_se: [{ ok: 1 }],
      next_customer_code: [{ next_seq: 1 }],
      create_customer: () => {
        throw new Error("db boom");
      },
    });
    await expect(createCustomer(boom, CTX, validInput() as never)).rejects.toThrow("db boom");
  });
});

describe("updateCustomer", () => {
  it("checks a changed phone and updates", async () => {
    const sql = makeSql({
      current_phone_for_edit: [{ norm: "9999999999" }],
      check_duplicate_phone: [],
      update_customer: [CROW],
    });
    expect(await updateCustomer(sql, CTX, "c1", { phone: "8888888888" } as never)).toMatchObject({ id: "c1" });
  });

  it("404s when the customer is missing", async () => {
    await expect(updateCustomer(makeSql({ update_customer: [] }), CTX, "c1", {} as never)).rejects.toMatchObject({ status: 404 });
  });
});

describe("updateCustomerStatus", () => {
  it("rejects an invalid status (422) and 404s a missing customer", async () => {
    await expect(updateCustomerStatus(makeSql(), CTX, "c1", "frozen")).rejects.toMatchObject({ status: 422 });
    await expect(updateCustomerStatus(makeSql({ update_customer_status: [] }), CTX, "c1", "inactive")).rejects.toMatchObject({ status: 404 });
  });

  it("updates and maps the row", async () => {
    const sql = makeSql({ update_customer_status: [CROW] });
    expect(await updateCustomerStatus(sql, CTX, "c1", "inactive")).toMatchObject({ id: "c1" });
  });
});
