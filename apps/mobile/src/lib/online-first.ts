// Online-first write policy with a local-queue safety net.
//
// The old flow wrote to on-device SQLite FIRST, then synced — so a broken local
// DB (e.g. "readonly database" when storage is full) could lose a delivery and
// block the driver even while online. This inverts that: try the server first;
// only fall back to the durable queue when the network genuinely fails; and if
// even that can't be persisted, report `unsaved` so the caller keeps the input
// in memory for retry instead of discarding it. Idempotency (clientUuid) makes
// the try-then-queue path safe against duplicates.

/** Outcome of a single write attempt. */
export type WriteOutcome<T> =
  | { status: "sent"; data: T } // server accepted it (source of truth)
  | { status: "queued" } // offline → parked in the local queue, will sync
  | { status: "unsaved"; reason: "storage" } // offline AND local DB unwritable
  | { status: "rejected"; error: unknown }; // permanent server rejection (4xx)

export interface SubmitDeps<T> {
  /** Direct API call. Resolves with the server record, rejects on failure. */
  send: () => Promise<T>;
  /** Persist to the durable local queue (fallback). Throws if storage is broken. */
  queue: () => void;
  /** Whether a failed `send` is worth queueing for later. Defaults below. */
  isRetryable?: (error: unknown) => boolean;
}

/**
 * A `send` failure is retryable (worth queueing) unless the server gave a
 * permanent 4xx — those won't succeed later with the same payload, so surfacing
 * them beats silently retrying forever. Network/timeout errors carry no HTTP
 * status and are always retryable. Mirrors sync-core's permanent-failure rule.
 */
export function defaultIsRetryable(error: unknown): boolean {
  const status = (error as { status?: unknown } | null | undefined)?.status;
  if (typeof status !== "number") return true; // network / timeout / unknown
  if (status === 401 || status === 408 || status === 429) return true; // transient
  return !(status >= 400 && status < 500); // any other 4xx is permanent
}

export async function submitWrite<T>(deps: SubmitDeps<T>): Promise<WriteOutcome<T>> {
  try {
    const data = await deps.send();
    return { status: "sent", data };
  } catch (sendError) {
    const retryable = (deps.isRetryable ?? defaultIsRetryable)(sendError);
    if (!retryable) return { status: "rejected", error: sendError };
    try {
      deps.queue();
      return { status: "queued" };
    } catch {
      return { status: "unsaved", reason: "storage" };
    }
  }
}
