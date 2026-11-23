import type { ConfigurableRole, PermissionCatalogEntry } from "./permissions-api";

// Pure helpers for the Role Panels view: per-role on/off maps, preset
// templates, and change math. Kept framework-free so they're unit-testable.

export type RoleMap = Record<string, boolean>;
export type RoleState = Record<ConfigurableRole, RoleMap>;

export const ROLES: ConfigurableRole[] = ["MANAGER", "ACCOUNTANT"];
export const ROLE_LABEL: Record<ConfigurableRole, string> = {
  MANAGER: "Manager",
  ACCOUNTANT: "Accountant",
};

export function cloneState(roles: RoleState): RoleState {
  return { MANAGER: { ...roles.MANAGER }, ACCOUNTANT: { ...roles.ACCOUNTANT } };
}

export type PresetId = "defaults" | "full" | "readonly" | "none";

export const PRESETS: { id: PresetId; label: string; hint: string }[] = [
  { id: "defaults", label: "Restore defaults", hint: "The role's original access" },
  { id: "full", label: "Full access", hint: "Everything on" },
  { id: "readonly", label: "Read-only", hint: "All sections, no actions" },
  { id: "none", label: "No access", hint: "Everything off" },
];

/** Build the on/off map a preset produces for one role over the catalog. */
export function presetMap(
  preset: PresetId,
  role: ConfigurableRole,
  catalog: PermissionCatalogEntry[],
): RoleMap {
  const out: RoleMap = {};
  for (const e of catalog) {
    out[e.key] =
      preset === "defaults"
        ? e.defaults[role]
        : preset === "full"
          ? true
          : preset === "none"
            ? false
            : e.kind === "section"; // readonly
  }
  return out;
}

/** How many of the catalog's capabilities are enabled for the role. */
export function enabledCount(map: RoleMap, catalog: PermissionCatalogEntry[]): number {
  return catalog.reduce((n, e) => n + (map[e.key] ? 1 : 0), 0);
}

/** Added/removed grants for a role versus its saved baseline. */
export function diffCounts(
  next: RoleMap,
  base: RoleMap,
  catalog: PermissionCatalogEntry[],
): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const e of catalog) {
    const a = next[e.key] ?? false;
    const b = base[e.key] ?? false;
    if (a && !b) added++;
    else if (!a && b) removed++;
  }
  return { added, removed };
}

/** Changed entries for one role, as the PUT /permissions/:role payload. */
export function changedEntries(
  next: RoleMap,
  base: RoleMap,
  catalog: PermissionCatalogEntry[],
): { key: string; allowed: boolean }[] {
  return catalog
    .filter((e) => (next[e.key] ?? false) !== (base[e.key] ?? false))
    .map((e) => ({ key: e.key, allowed: next[e.key] ?? false }));
}
