import { DurableObject } from "cloudflare:workers";

/**
 * Inbound-server configuration, held in one strongly-consistent Durable Object
 * so the passphrase gate and the admin API always agree regardless of region.
 *
 * `enabled` is the master switch (a disabled server rejects every login).
 * `passphrase` is the shared access phrase a connector types to sign in. It is
 * stored as-is (not hashed) on purpose: it is an access key the admin hands out
 * and needs to be able to read back and share — not a personal login. When null
 * the gate falls back to the legacy `env.MCP_PASSPHRASE` secret, so the live
 * Claude connection keeps working until an admin sets one from the web.
 */
export interface ServerConfig {
  enabled: boolean;
  passphrase: string | null;
  passphraseSetAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

// Default for a DO that has never been written: ENABLED with no passphrase, so a
// freshly deployed Worker keeps honouring the existing env passphrase and the
// current connection does not break. Admins turn it off / set one from Settings.
const DEFAULTS: ServerConfig = {
  enabled: true,
  passphrase: null,
  passphraseSetAt: null,
  updatedAt: null,
  updatedBy: null,
};

export class ConfigDO extends DurableObject {
  async get(): Promise<ServerConfig> {
    const stored = await this.ctx.storage.get<ServerConfig>("config");
    return { ...DEFAULTS, ...(stored ?? {}) };
  }

  /** Merge a partial update and stamp who/when. `passphrase` of null clears it. */
  async update(patch: Partial<ServerConfig>, updatedBy: string | null): Promise<ServerConfig> {
    const current = await this.get();
    const next: ServerConfig = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
      updatedBy,
    };
    if (Object.prototype.hasOwnProperty.call(patch, "passphrase")) {
      next.passphraseSetAt = patch.passphrase ? new Date().toISOString() : null;
    }
    await this.ctx.storage.put("config", next);
    return next;
  }
}
