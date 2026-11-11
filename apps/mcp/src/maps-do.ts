import { DurableObject } from "cloudflare:workers";
import type { VardhanMapSpec } from "./spec";

export interface StoredMap {
  spec: VardhanMapSpec;
  createdAt: string; // ISO
}

/** How long a stored map lives before it's pruned (also the link's max lifetime). */
export const MAP_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_ENTRIES = 2000;

/**
 * Stores rendered map specs by id, so the interactive `/m/<id>` page can fetch
 * one to hydrate. A single strongly-consistent Durable Object (same pattern as
 * the audit log) — no KV namespace to provision. Old entries are pruned by TTL
 * and a hard cap.
 */
export class MapsStoreDO extends DurableObject {
  async put(id: string, spec: VardhanMapSpec): Promise<void> {
    const now = Date.now();
    const map = (await this.ctx.storage.get<Record<string, StoredMap>>("maps")) ?? {};
    map[id] = { spec, createdAt: new Date(now).toISOString() };
    for (const [key, v] of Object.entries(map)) {
      if (now - Date.parse(v.createdAt) > MAP_TTL_MS) delete map[key];
    }
    const ids = Object.keys(map);
    if (ids.length > MAX_ENTRIES) {
      ids
        .sort((a, b) => Date.parse(map[a].createdAt) - Date.parse(map[b].createdAt))
        .slice(0, ids.length - MAX_ENTRIES)
        .forEach((k) => delete map[k]);
    }
    await this.ctx.storage.put("maps", map);
  }

  async get(id: string): Promise<StoredMap | null> {
    const map = (await this.ctx.storage.get<Record<string, StoredMap>>("maps")) ?? {};
    const hit = map[id];
    if (!hit) return null;
    if (Date.now() - Date.parse(hit.createdAt) > MAP_TTL_MS) return null;
    return hit;
  }
}
