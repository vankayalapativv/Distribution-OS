/**
 * The one place the app opens the real native SQLite database. Isolated into its
 * own module so db.ts (the LocalDb adapter + migration + caching) stays
 * node-testable: tests mock this module instead of the native expo-sqlite build,
 * which cannot load under Node. Excluded from coverage — it is pure native glue
 * exercised only on-device.
 */
import type { SQLiteDatabase } from "expo-sqlite";

export function openNativeDb(): SQLiteDatabase {
  // Lazy require so the web bundle never touches the native module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { openDatabaseSync } = require("expo-sqlite") as typeof import("expo-sqlite");
  return openDatabaseSync("distribution-os.db");
}
