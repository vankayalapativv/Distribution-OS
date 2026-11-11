import { describe, expect, it, vi } from "vitest";

const { neon } = vi.hoisted(() => ({ neon: vi.fn(() => "SQL") }));
vi.mock("@neondatabase/serverless", () => ({ neon }));

import { createScopedSqlClient, getSqlClient } from "./db";
import type { Context } from "hono";
import type { ApiEnv, AuthContext } from "../types";

function ctx(env: Record<string, unknown>, auth?: Partial<AuthContext>): Context<ApiEnv> {
  return {
    env,
    get: (k: string) => (k === "auth" ? auth : undefined),
  } as unknown as Context<ApiEnv>;
}

describe("getSqlClient", () => {
  it("returns the unscoped Neon client for an unauthenticated request", () => {
    expect(getSqlClient(ctx({ DATABASE_URL: "postgres://x" }))).toBe("SQL");
    expect(neon).toHaveBeenCalledWith("postgres://x");
  });

  it("throws DATABASE_NOT_CONFIGURED (500) when DATABASE_URL is missing", () => {
    let err: unknown;
    try {
      getSqlClient(ctx({}));
    } catch (e) {
      err = e;
    }
    expect(err).toMatchObject({ code: "DATABASE_NOT_CONFIGURED", status: 500 });
  });

  it("throws NO_ENTERPRISE_CONTEXT (403) for an authenticated user with no enterprise", () => {
    let err: unknown;
    try {
      getSqlClient(ctx({ DATABASE_URL: "postgres://x" }, { isAuthenticated: true, enterpriseId: null }));
    } catch (e) {
      err = e;
    }
    expect(err).toMatchObject({ code: "NO_ENTERPRISE_CONTEXT", status: 403 });
  });

  it("returns a scoped client (not the bare base) for an authenticated enterprise user", () => {
    const scoped = getSqlClient(
      ctx({ DATABASE_URL: "postgres://x" }, { isAuthenticated: true, enterpriseId: "ent-1", userId: "u1" }),
    );
    // scoped adapter is a function with a .transaction method, not the bare "SQL" string
    expect(typeof scoped).toBe("function");
    expect(scoped).not.toBe("SQL");
  });
});

describe("createScopedSqlClient scoping contract", () => {
  type Desc = { text: string; vals: unknown[] };
  function fakeBase() {
    const batches: Desc[][] = [];
    const tag = ((strings: TemplateStringsArray, ...vals: unknown[]): Desc => ({
      text: strings.join("?"),
      vals,
    })) as unknown as {
      (strings: TemplateStringsArray, ...vals: unknown[]): Desc;
      transaction: (descs: Desc[]) => Promise<unknown[]>;
      query: (text: string, params?: unknown[]) => Desc;
      unsafe: (text: string) => Desc;
    };
    tag.transaction = (descs: Desc[]) => {
      batches.push(descs);
      return Promise.resolve(descs.map(() => []));
    };
    tag.query = (text: string, params: unknown[] = []) => ({ text, vals: params });
    tag.unsafe = (text: string) => ({ text, vals: [] });
    return { tag, batches };
  }

  it("prefixes every query with SET LOCAL ROLE app_tenant + the enterprise/user GUCs", async () => {
    const { tag, batches } = fakeBase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scoped = createScopedSqlClient(tag as any, "ent-9", "user-7");

    await scoped`select 1 from customers`;

    expect(batches).toHaveLength(1);
    const batch = batches[0];
    const texts = batch.map((d) => d.text);
    // the three scope statements come first, in order, then the caller's query
    expect(texts[0]).toContain("set local role app_tenant");
    expect(texts[1]).toContain("set_config('app.enterprise_id'");
    expect(batch[1].vals).toContain("ent-9");
    expect(texts[2]).toContain("set_config('app.user_id'");
    expect(batch[2].vals).toContain("user-7");
    expect(texts[3]).toContain("select 1 from customers");
  });

  it("scopes .query() calls the same way, pinning the caller's enterprise", async () => {
    const { tag, batches } = fakeBase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scoped = createScopedSqlClient(tag as any, "ent-42", null);

    await scoped.query("select count(*) from invoices");

    const batch = batches[0];
    expect(batch[0].text).toContain("set local role app_tenant");
    expect(batch[1].vals).toContain("ent-42");
    expect(batch[batch.length - 1].text).toContain("select count(*) from invoices");
  });
});
