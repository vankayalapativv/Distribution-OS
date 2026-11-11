/**
 * Test double for the LocalDb interface backed by Node's built-in sqlite.
 * expo-sqlite provides the same shape at runtime (see src/lib/db.ts).
 */
import { DatabaseSync } from "node:sqlite";
import type { LocalDb, SqlValue } from "../lib/local-db";

export function createTestDb(): LocalDb {
  const db = new DatabaseSync(":memory:");
  return {
    exec: (sql: string) => {
      db.exec(sql);
    },
    run: (sql: string, params: SqlValue[] = []) => {
      db.prepare(sql).run(...(params as never[]));
    },
    all: <T>(sql: string, params: SqlValue[] = []): T[] =>
      db.prepare(sql).all(...(params as never[])) as T[],
    first: <T>(sql: string, params: SqlValue[] = []): T | null =>
      (db.prepare(sql).get(...(params as never[])) as T | undefined) ?? null,
  };
}
