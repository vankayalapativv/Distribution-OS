/**
 * Migration runner + tracking table (architecture audit G-0303).
 *
 * Replaces the manual "apply each `packages/db/migrations/00NN.sql` by hand with
 * `psql -f`, with no record of what ran" process. Applies pending migrations in
 * filename order and records each in a `schema_migrations` tracking table, so the
 * same DB is never migrated twice and a fresh/tenant DB can be brought up with one
 * command.
 *
 * Usage (from repo root):
 *   pnpm --filter @sri-aparajita/db run migrate            # apply all pending
 *   pnpm --filter @sri-aparajita/db run migrate -- --status    # list applied/pending
 *   pnpm --filter @sri-aparajita/db run migrate -- --baseline  # adopt on an EXISTING DB:
 *        record every current migration file as applied WITHOUT running it
 *
 * IMPORTANT for THIS repo: production and dev currently share one DB (audit
 * G-0303). On first adoption run `--baseline` against that existing DB so the 79
 * already-applied migrations are recorded, NOT re-run. Only genuinely new
 * migrations will then apply. Once prod/dev are split, run normally per DB.
 *
 * Migrations are expected to be additive/idempotent (the project's stated policy);
 * 17 files carry their own BEGIN/COMMIT, so each file is executed as-is (not
 * wrapped in an outer transaction) and then recorded.
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import postgres from "postgres";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });

const MIGRATIONS_DIR = fileURLToPath(new URL("../migrations", import.meta.url));

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function listMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b)); // 0001_… < 0002_… lexicographic = chronological given zero-padding
}

type Sql = ReturnType<typeof postgres>;

/** Warn about any recorded migration whose file content changed after it was
 *  applied — migrations are meant to be immutable once applied. */
function checkDrift(files: string[], applied: Map<string, string>): void {
  for (const f of files) {
    const rec = applied.get(f);
    if (rec && rec !== sha256(readFileSync(`${MIGRATIONS_DIR}/${f}`, "utf8"))) {
      console.warn(`⚠️  DRIFT: ${f} changed after being applied (recorded ${rec}). Migrations should be immutable once applied.`);
    }
  }
}

/** `--status`: print the applied / pending counts and list the pending files. */
function runStatus(applied: Map<string, string>, pending: string[], fileCount: number): void {
  console.log(`Applied: ${applied.size}  |  Pending: ${pending.length}  |  Total files: ${fileCount}`);
  for (const f of pending) console.log(`  pending  ${f}`);
}

/** `--baseline`: record pending files as applied WITHOUT running them (adoption
 *  on an existing DB). */
async function runBaseline(sql: Sql, pending: string[]): Promise<void> {
  if (pending.length === 0) {
    console.log("Nothing to baseline — all migration files are already recorded.");
    return;
  }
  const rows = pending.map((f) => ({ filename: f, checksum: sha256(readFileSync(`${MIGRATIONS_DIR}/${f}`, "utf8")) }));
  await sql`insert into schema_migrations ${sql(rows, "filename", "checksum")} on conflict (filename) do nothing`;
  console.log(`Baselined ${rows.length} migration(s) as applied WITHOUT running them.`);
}

/** Default mode: run each pending migration file as-is (it may carry its own
 *  BEGIN/COMMIT) and record it. */
async function runApply(sql: Sql, pending: string[]): Promise<void> {
  if (pending.length === 0) {
    console.log("Up to date — no pending migrations.");
    return;
  }
  for (const f of pending) {
    const text = readFileSync(`${MIGRATIONS_DIR}/${f}`, "utf8");
    process.stdout.write(`Applying ${f} … `);
    await sql.unsafe(text); // file may carry its own BEGIN/COMMIT; run as-is
    await sql`insert into schema_migrations (filename, checksum) values (${f}, ${sha256(text)}) on conflict (filename) do nothing`;
    console.log("done");
  }
  console.log(`Applied ${pending.length} migration(s).`);
}

function resolveMode(args: Set<string>): "baseline" | "status" | "apply" {
  if (args.has("--baseline")) return "baseline";
  if (args.has("--status")) return "status";
  return "apply";
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const mode = resolveMode(args);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("ERROR: DATABASE_URL is not set in .env");
    process.exit(1);
  }

  // Silence routine NOTICEs (e.g. "relation … already exists, skipping") so CI
  // logs stay clean; real errors still throw.
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    await sql`
      create table if not exists schema_migrations (
        filename text primary key,
        checksum text not null,
        applied_at timestamptz not null default now()
      )
    `;

    const files = listMigrationFiles();
    const appliedRows = await sql<{ filename: string; checksum: string }[]>`
      select filename, checksum from schema_migrations
    `;
    const applied = new Map(appliedRows.map((r) => [r.filename, r.checksum]));

    checkDrift(files, applied);
    const pending = files.filter((f) => !applied.has(f));

    if (mode === "status") {
      runStatus(applied, pending, files.length);
      return;
    }
    if (mode === "baseline") {
      await runBaseline(sql, pending);
      return;
    }
    await runApply(sql, pending);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("Migration failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
