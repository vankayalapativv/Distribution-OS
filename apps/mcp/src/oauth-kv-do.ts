import { DurableObject } from "cloudflare:workers";

/** One stored record: the value string + optional metadata + absolute expiry (ms). */
interface StoredRecord {
  v: string;
  m?: unknown;
  e: number | null;
}

/**
 * A single-instance, strongly-consistent KV store for the OAuth provider.
 *
 * Because it is ONE Durable Object, every read and write serialises through it
 * regardless of the caller's region — which eliminates the Cloudflare KV
 * cross-region read-after-write race that made Claude's `/token` exchange fail
 * with "Grant not found" (the code was written near the user but read from
 * another region before KV propagated). Only the KVNamespace subset the provider
 * actually uses (get / put / delete / list) is implemented.
 */
export class OAuthKvDO extends DurableObject {
  async kvGet(key: string, asJson: boolean): Promise<unknown> {
    const rec = (await this.ctx.storage.get<StoredRecord>(key)) ?? null;
    if (!rec) return null;
    if (rec.e !== null && Date.now() > rec.e) {
      await this.ctx.storage.delete(key);
      return null;
    }
    return asJson ? JSON.parse(rec.v) : rec.v;
  }

  async kvPut(
    key: string,
    value: string,
    opts: { expiration?: number; expirationTtl?: number; metadata?: unknown },
  ): Promise<void> {
    let e: number | null = null;
    if (typeof opts.expirationTtl === "number") e = Date.now() + opts.expirationTtl * 1000;
    else if (typeof opts.expiration === "number") e = opts.expiration * 1000;
    await this.ctx.storage.put<StoredRecord>(key, { v: value, m: opts.metadata, e });
  }

  async kvDelete(key: string): Promise<void> {
    await this.ctx.storage.delete(key);
  }

  async kvList(opts: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: { name: string; expiration?: number; metadata?: unknown }[];
    list_complete: boolean;
    cursor?: string;
  }> {
    const limit = opts.limit ?? 1000;
    const map = await this.ctx.storage.list<StoredRecord>({
      prefix: opts.prefix,
      limit,
      startAfter: opts.cursor,
    });
    const now = Date.now();
    const keys: { name: string; expiration?: number; metadata?: unknown }[] = [];
    let lastKey: string | undefined;
    for (const [name, rec] of map) {
      lastKey = name;
      if (rec.e !== null && now > rec.e) continue; // hide expired
      keys.push({
        name,
        expiration: rec.e !== null ? Math.floor(rec.e / 1000) : undefined,
        metadata: rec.m,
      });
    }
    const list_complete = map.size < limit;
    return { keys, list_complete, cursor: list_complete ? undefined : lastKey };
  }
}

/** Present a DO stub as the KVNamespace subset the OAuth provider consumes. */
export function makeConsistentKV(stub: DurableObjectStub<OAuthKvDO>): KVNamespace {
  const kv = {
    async get(key: string, options?: unknown): Promise<unknown> {
      const asJson =
        options === "json" ||
        (typeof options === "object" &&
          options !== null &&
          (options as { type?: string }).type === "json");
      return stub.kvGet(key, asJson === true);
    },
    async put(key: string, value: unknown, options?: unknown): Promise<void> {
      const v = typeof value === "string" ? value : String(value);
      return stub.kvPut(key, v, (options as Record<string, number | unknown>) ?? {});
    },
    async delete(key: string): Promise<void> {
      return stub.kvDelete(key);
    },
    async list(options?: unknown): Promise<unknown> {
      return stub.kvList((options as Record<string, unknown>) ?? {});
    },
  };
  return kv as unknown as KVNamespace;
}
