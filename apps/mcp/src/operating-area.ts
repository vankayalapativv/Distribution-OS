import { runReadOnlySql } from "./db";

export interface OperatingDistrict {
  state: string;
  name: string;
}

/**
 * The deployment's operating districts — the districts this Sri Aparajita client actually
 * works in (a distributor covers a few districts, not all of India). Stored as a
 * JSON array in `system_settings` under `operating_area`, e.g.
 *   [{ "state": "Telangana", "name": "Nalgonda" }, …]
 * Returns null when unset / unparyseable, so maps then render exactly as given.
 */
export async function getOperatingArea(replicaUrl: string): Promise<OperatingDistrict[] | null> {
  try {
    const { rows } = await runReadOnlySql(
      replicaUrl,
      "select value from system_settings where key = 'operating_area' limit 1",
    );
    const raw = rows[0]?.value;
    if (typeof raw !== "string") return null;
    const parsed = JSON.parse(raw) as OperatingDistrict[];
    const clean = (Array.isArray(parsed) ? parsed : []).filter(
      (d) => d && typeof d.state === "string" && d.state.trim() && typeof d.name === "string" && d.name.trim(),
    );
    return clean.length ? clean : null;
  } catch {
    return null;
  }
}

/**
 * True when a spec already names an explicit geographic scope (specific districts,
 * a state, or several states) — in which case we must NOT override it with the
 * operating-area default. A bare region (india / state / district) with no named
 * state or districts is treated as "no explicit scope".
 */
export function hasExplicitScope(map: {
  state?: string;
  states?: string[];
  districts?: { state: string; name: string }[];
}): boolean {
  return !!map.districts?.length || !!map.state?.trim() || !!(map.states && map.states.length);
}
