import type { SqlClient } from "../lib/db";
import type { Role } from "../types";

// Configurable role permissions (SUPER_ADMIN controls what MANAGER and ACCOUNTANT
// can access). This module is the SINGLE SOURCE OF TRUTH for the permission
// CATALOG and its per-role DEFAULTS. Defaults exactly mirror the pre-feature
// hardcoded access, so enabling the feature changes nothing until SA edits a
// toggle. The `role_permissions` table (migration 0073) stores only OVERRIDES;
// an absent row falls back to the catalog default here.
//
// SUPER_ADMIN is implicitly all-allowed (never stored, never checked).
// SALES_EXECUTIVE / LOGISTICS are out of scope — their access stays role-based.

export type PermissionKind = "section" | "action";

/** The two roles whose access SA can configure. */
export const CONFIGURABLE_ROLES = ["MANAGER", "ACCOUNTANT"] as const;
export type ConfigurableRole = (typeof CONFIGURABLE_ROLES)[number];

export function isConfigurableRole(role: Role | null): role is ConfigurableRole {
  return role === "MANAGER" || role === "ACCOUNTANT";
}

export interface PermissionDef {
  key: string; // "section:collections" | "action:collections.verify"
  kind: PermissionKind;
  label: string;
  /** Grouping label for the SA matrix UI. */
  group: string;
  /** Defaults = current hardcoded behavior (true = had access before this feature). */
  defaults: Record<ConfigurableRole, boolean>;
}

const T = true;
const F = false;
const d = (m: boolean, a: boolean): Record<ConfigurableRole, boolean> => ({
  MANAGER: m,
  ACCOUNTANT: a,
});

/**
 * Section keys mirror the sidebar nav (dashboard-nav.tsx). Defaults = whether the
 * section is in that role's nav today. Overview (Dashboard/KPIs) is the role's
 * home and is intentionally NOT configurable.
 */
const SECTIONS: PermissionDef[] = [
  { key: "section:customers", kind: "section", label: "Customers", group: "Sections", defaults: d(T, T) },
  { key: "section:orders", kind: "section", label: "Orders", group: "Sections", defaults: d(T, T) },
  { key: "section:products", kind: "section", label: "Products", group: "Sections", defaults: d(T, T) },
  { key: "section:invoices", kind: "section", label: "Invoices", group: "Sections", defaults: d(F, T) },
  { key: "section:stock", kind: "section", label: "Stock Journal", group: "Sections", defaults: d(F, F) },
  { key: "section:collections", kind: "section", label: "Collections", group: "Sections", defaults: d(T, T) },
  { key: "section:alerts", kind: "section", label: "Alerts", group: "Sections", defaults: d(T, F) },
  { key: "section:tasks", kind: "section", label: "Tasks", group: "Sections", defaults: d(T, T) },
  { key: "section:tracking", kind: "section", label: "Live Tracking", group: "Sections", defaults: d(T, F) },
  { key: "section:attendance", kind: "section", label: "Attendance", group: "Sections", defaults: d(T, T) },
  { key: "section:logistics", kind: "section", label: "Logistics", group: "Sections", defaults: d(T, T) },
  { key: "section:market-intelligence", kind: "section", label: "Market Intelligence", group: "Sections", defaults: d(T, F) },
  { key: "section:reports", kind: "section", label: "Reports", group: "Sections", defaults: d(T, T) },
  { key: "section:targets", kind: "section", label: "Targets", group: "Sections", defaults: d(T, F) },
  { key: "section:beat-plans", kind: "section", label: "Beat Plans", group: "Sections", defaults: d(T, F) },
  { key: "section:expenditures", kind: "section", label: "Expenditure", group: "Sections", defaults: d(T, T) },
  { key: "section:incentives", kind: "section", label: "Incentives", group: "Sections", defaults: d(T, T) },
];

/**
 * Curated high-value actions, each mapped to a specific role-gated mutation.
 * Defaults = which of the two roles could perform it before this feature.
 */
const ACTIONS: PermissionDef[] = [
  { key: "action:collections.verify", kind: "action", label: "Verify / reject collections", group: "Actions", defaults: d(F, T) },
  // Accountant currently posts here only for credit notes (an inner guard keeps
  // that limit); default on for both to preserve behavior — the toggle just lets
  // SA disable recording entirely for a role.
  { key: "action:collections.record", kind: "action", label: "Record a collection", group: "Actions", defaults: d(T, T) },
  { key: "action:customers.edit", kind: "action", label: "Create / edit customers", group: "Actions", defaults: d(T, F) },
  { key: "action:orders.create", kind: "action", label: "Create orders", group: "Actions", defaults: d(T, F) },
  { key: "action:products.manage", kind: "action", label: "Add / remove products", group: "Actions", defaults: d(T, F) },
  // Write access to the stock journal (GRN / transfers / adjustments / opening).
  // Only meaningful once the Stock Journal section is granted to the role.
  { key: "action:stock.manage", kind: "action", label: "Manage stock (GRN / transfers / adjustments)", group: "Actions", defaults: d(T, F) },
  // In-system GST invoice generation / edit / cancel (the Accountant's job today).
  { key: "action:invoices.generate", kind: "action", label: "Generate / cancel invoices", group: "Actions", defaults: d(F, T) },
  { key: "action:expenditures.manage", kind: "action", label: "Manage expenditures", group: "Actions", defaults: d(T, T) },
  { key: "action:alerts.close", kind: "action", label: "Close alerts", group: "Actions", defaults: d(T, F) },
  { key: "action:targets.edit", kind: "action", label: "Edit targets", group: "Actions", defaults: d(T, F) },
];

export const PERMISSION_CATALOG: PermissionDef[] = [...SECTIONS, ...ACTIONS];

const CATALOG_KEYS = new Set(PERMISSION_CATALOG.map((p) => p.key));
export function isKnownPermissionKey(key: string): boolean {
  return CATALOG_KEYS.has(key);
}

/** Catalog defaults for a configurable role, as a full key→bool map. */
function defaultsFor(role: ConfigurableRole): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const def of PERMISSION_CATALOG) out[def.key] = def.defaults[role];
  return out;
}

/** Fetch a role's stored overrides (empty for non-configurable roles). */
async function fetchOverrides(sql: SqlClient, role: ConfigurableRole): Promise<Record<string, boolean>> {
  const rows = (await sql`
    /* role_permission_overrides */
    select permission_key as "key", allowed
    from role_permissions
    where role_code = ${role}
  `) as { key: string; allowed: boolean }[];
  const out: Record<string, boolean> = {};
  for (const r of rows) if (CATALOG_KEYS.has(r.key)) out[r.key] = r.allowed === true;
  return out;
}

/** Effective (defaults merged with overrides) permission map for a role. */
export async function getRolePermissions(
  sql: SqlClient,
  role: ConfigurableRole,
): Promise<Record<string, boolean>> {
  const [base, overrides] = [defaultsFor(role), await fetchOverrides(sql, role)];
  return { ...base, ...overrides };
}

// ── Isolate-local cache for enforcement ───────────────────────────────────────
// Mirrors auth-profile's approach: a best-effort, short-TTL cache so per-request
// capability checks don't hit the DB. Keyed by role (only 2 entries). On a DB
// blip we serve a stale entry, else fall back to catalog defaults (= pre-feature
// behavior) rather than failing the request open-ended.
const PERM_TTL_MS = 10_000;
const MAX_STALE_MS = 60_000;
interface PermEntry {
  value: Record<string, boolean>;
  fetchedAt: number;
}
const permCache = new Map<ConfigurableRole, PermEntry>();

export async function getEffectivePermissionsCached(
  sql: SqlClient,
  role: ConfigurableRole,
): Promise<Record<string, boolean>> {
  const now = Date.now();
  const cached = permCache.get(role);
  if (cached && now - cached.fetchedAt < PERM_TTL_MS) return cached.value;
  try {
    const value = await getRolePermissions(sql, role);
    permCache.set(role, { value, fetchedAt: now });
    return value;
  } catch (error) {
    if (cached && now - cached.fetchedAt < MAX_STALE_MS) return cached.value;
    console.error("role permissions lookup failed; using catalog defaults:", error);
    return defaultsFor(role);
  }
}

/** Test-only: clear the isolate cache between cases. */
export function __clearPermissionCache(): void {
  permCache.clear();
}

/** Effective permissions for ANY role — SUPER_ADMIN is all-true. */
export async function effectivePermissionsForRole(
  sql: SqlClient,
  role: Role | null,
): Promise<Record<string, boolean>> {
  if (role === "SUPER_ADMIN") {
    const all: Record<string, boolean> = {};
    for (const def of PERMISSION_CATALOG) all[def.key] = true;
    return all;
  }
  if (isConfigurableRole(role)) return getEffectivePermissionsCached(sql, role);
  // SE / LOGISTICS / unauthenticated: this catalog doesn't govern them.
  return {};
}

// ── SA management surface ─────────────────────────────────────────────────────

export interface PermissionMatrix {
  catalog: { key: string; kind: PermissionKind; label: string; group: string }[];
  roles: Record<ConfigurableRole, Record<string, boolean>>;
}

/** The full catalog + effective values per configurable role, for the SA page. */
export async function getPermissionMatrix(sql: SqlClient): Promise<PermissionMatrix> {
  const [manager, accountant] = await Promise.all([
    getRolePermissions(sql, "MANAGER"),
    getRolePermissions(sql, "ACCOUNTANT"),
  ]);
  return {
    catalog: PERMISSION_CATALOG.map(({ key, kind, label, group }) => ({ key, kind, label, group })),
    roles: { MANAGER: manager, ACCOUNTANT: accountant },
  };
}

/**
 * Split requested updates into rows to upsert (differ from the catalog default)
 * and keys to delete (equal the default → no override needed). Invalid keys are
 * dropped. Pure + exported for unit testing.
 */
export function partitionPermissionUpdates(
  role: ConfigurableRole,
  entries: { key: string; allowed: boolean }[],
): { toUpsert: { key: string; allowed: boolean }[]; toDelete: string[] } {
  const valid = entries.filter((e) => CATALOG_KEYS.has(e.key));
  const defaults = defaultsFor(role);
  return {
    toUpsert: valid.filter((e) => e.allowed !== defaults[e.key]),
    toDelete: valid.filter((e) => e.allowed === defaults[e.key]).map((e) => e.key),
  };
}

/**
 * Upsert a role's overrides. Each entry sets one catalog key on/off. A value
 * equal to the catalog default deletes the override row (keeps the table minimal
 * and self-healing if defaults change later). Invalid role/keys are rejected.
 */
export async function setRolePermissions(
  sql: SqlClient,
  role: ConfigurableRole,
  entries: { key: string; allowed: boolean }[],
  userId: string,
): Promise<Record<string, boolean>> {
  if (!isConfigurableRole(role)) {
    throw new Error(`Role ${role} is not configurable`);
  }
  const { toUpsert, toDelete } = partitionPermissionUpdates(role, entries);

  const statements = [];
  for (const e of toUpsert) {
    statements.push(sql`
      /* role_permission_upsert */
      insert into role_permissions (role_code, permission_key, allowed, updated_at, updated_by)
      values (${role}, ${e.key}, ${e.allowed}, now(), ${userId}::uuid)
      on conflict (role_code, permission_key)
      do update set allowed = excluded.allowed, updated_at = now(), updated_by = excluded.updated_by
    `);
  }
  if (toDelete.length > 0) {
    statements.push(sql`
      /* role_permission_reset_to_default */
      delete from role_permissions
      where role_code = ${role} and permission_key = any(${toDelete}::text[])
    `);
  }
  if (statements.length > 0) await sql.transaction(statements);

  permCache.delete(role); // force a fresh read on next enforcement check
  return getRolePermissions(sql, role);
}
