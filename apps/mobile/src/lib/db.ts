/**
 * Runtime LocalDb backed by expo-sqlite. The interface matches the pure
 * modules (local-db.ts, sync-core.ts, beat-cache.ts) that are unit-tested
 * against node:sqlite.
 *
 * On web (dev preview only — the shipped app is native) expo-sqlite is not
 * available, so getLocalDb() returns null and callers skip offline caching.
 */
import { Platform } from "react-native";
import type { SQLiteDatabase } from "expo-sqlite";
import { migrateLocalDb, type LocalDb, type SqlValue } from "./local-db";

function wrapExpoDb(db: SQLiteDatabase): LocalDb {
  return {
    exec: (sql) => db.execSync(sql),
    run: (sql, params = []) => {
      db.runSync(sql, params as SqlValue[]);
    },
    all: <T>(sql: string, params: SqlValue[] = []) =>
      db.getAllSync<T>(sql, params),
    first: <T>(sql: string, params: SqlValue[] = []) =>
      db.getFirstSync<T>(sql, params) ?? null,
  };
}

let instance: LocalDb | null = null;

export function getLocalDb(): LocalDb | null {
  if (Platform.OS === "web") return null;
  if (!instance) {
    // Lazy require so the web bundle never touches the native module.
    const { openDatabaseSync } = require("expo-sqlite") as typeof import("expo-sqlite");
    instance = wrapExpoDb(openDatabaseSync("distribution-os.db"));
    migrateLocalDb(instance);
  }
  return instance;
}
