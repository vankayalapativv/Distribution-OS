/**
 * Test harness: a fake Neon `SqlClient` for unit-testing services without a DB.
 *
 * Services tag every query with a `/* comment *\/` (project convention). This mock
 * routes each tagged-template call to a canned response keyed by that tag, so a
 * test says "when the service runs `/* list_things *\/`, return these rows" and
 * drives the service's branches (found / not-found / error) deterministically.
 *
 *   const sql = makeSql({
 *     get_customer: [{ id: "c1" }],          // first row drives the happy path
 *     checkin_open_visit_guard: [],          // empty → "no open visit" branch
 *     create_visit: () => { throw new Error("boom"); }, // error path
 *   });
 *
 * `sql.transaction([...])` resolves its statements; `sql.unsafe(text)` routes on a
 * synthetic `/*unsafe*\/` tag. `sql.calls` records every query for assertions.
 */
import type { SqlClient } from "../lib/db";

export type Row = Record<string, unknown>;
/** Rows to return, or a function of the call (its tag, params, raw text). */
export type QueryResponder = Row[] | ((ctx: { tag: string; params: unknown[]; text: string }) => Row[]);

export interface RecordedCall {
  tag: string;
  text: string;
  params: unknown[];
}

const TAG = /\/\*\s*([a-z0-9_]+)\s*\*\//i;

function tagOf(text: string): string {
  return TAG.exec(text)?.[1] ?? "";
}

/** Build a mock SqlClient. `responses` maps a query's `/* tag *\/` to its rows. */
export function makeSql(responses: Record<string, QueryResponder> = {}): SqlClient & { calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];

  const resolve = (text: string, params: unknown[]): Row[] => {
    const tag = tagOf(text);
    const r = responses[tag];
    if (r === undefined) return [];
    return typeof r === "function" ? r({ tag, params, text }) : r;
  };

  const fn = ((strings: TemplateStringsArray, ...values: unknown[]): Promise<Row[]> => {
    // Neon also allows calling `sql(...)` as a fragment/bulk helper (not a tagged
    // template). Those are only ever interpolated into another query, never
    // awaited on their own — return an inert marker.
    if (!Array.isArray((strings as unknown as { raw?: unknown }).raw)) {
      return { __fragment: true, strings, values } as unknown as Promise<Row[]>;
    }
    const text = (strings as readonly string[]).join(" ? ");
    calls.push({ tag: tagOf(text), text, params: values });
    return Promise.resolve(resolve(text, values));
  }) as unknown as SqlClient & { calls: RecordedCall[] };

  (fn as unknown as { transaction: (s: unknown[]) => Promise<unknown[]> }).transaction = async (stmts) =>
    Promise.all(stmts as Promise<unknown>[]);
  (fn as unknown as { unsafe: (t: string) => Promise<Row[]> }).unsafe = (text) =>
    Promise.resolve(resolve(`/*unsafe*/ ${text}`, []));
  // Neon's parameterized form `sql.query(text, params)` — routes on the text's
  // `/* tag *\/` just like a tagged template, and is recorded in `calls`.
  (fn as unknown as { query: (t: string, p?: unknown[]) => Promise<Row[]> }).query = (text, p = []) => {
    calls.push({ tag: tagOf(text), text, params: p });
    return Promise.resolve(resolve(text, p));
  };
  fn.calls = calls;

  return fn;
}

/** True if a query with the given `/* tag *\/` was executed on this mock. */
export function calledTag(sql: { calls: RecordedCall[] }, tag: string): boolean {
  return sql.calls.some((c) => c.tag === tag);
}
