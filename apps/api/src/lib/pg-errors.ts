/**
 * Postgres / Neon error helpers.
 *
 * The Neon HTTP driver throws a `NeonDbError` that carries the SQLSTATE `code`
 * and, for a constraint failure, the `constraint` (index/constraint name) and
 * `detail`. Those fields aren't always populated identically across driver
 * versions, so the checks below also fall back to message matching.
 */
const UNIQUE_VIOLATION = "23505";

interface PgLikeError {
  code?: string;
  constraint?: string;
  detail?: string;
  message?: string;
}

/**
 * True when `err` is a unique-violation. When `constraint` is given, true only
 * if the violation is for that specific constraint/index (so a code-collision
 * can be told apart from a clientUuid replay collision). `constraint` may be a
 * list — true if the violation matches ANY of them (e.g. an invoice generate
 * that allocates both an invoice number and a backing-order code can collide on
 * either, and both should retry).
 */
export function isUniqueViolation(err: unknown, constraint?: string | string[]): boolean {
  const e = err as PgLikeError | null;
  if (!e || typeof e !== "object") return false;
  const unique =
    e.code === UNIQUE_VIOLATION ||
    /duplicate key value|unique constraint/i.test(e.message ?? "");
  if (!unique) return false;
  if (!constraint) return true;
  const names = Array.isArray(constraint) ? constraint : [constraint];
  return names.some(
    (name) =>
      e.constraint === name ||
      (e.detail ?? "").includes(name) ||
      (e.message ?? "").includes(name),
  );
}

/**
 * Run `fn`, retrying ONLY on a unique-violation (optionally scoped to a specific
 * constraint). For racy `max(seq)+1` code generation (ORD-####, COLL-####, …):
 * on a collision, recompute inside `fn` and retry. Any other error — or a
 * unique-violation on a different constraint — is rethrown immediately.
 */
export async function retryOnUniqueViolation<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; constraint?: string | string[] } = {},
): Promise<T> {
  const attempts = Math.max(1, opts.attempts ?? 3);
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i < attempts - 1 && isUniqueViolation(err, opts.constraint)) {
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  /* v8 ignore next -- unreachable: the final loop iteration always returns or throws; kept so TS sees a return on every path */
  throw lastErr;
}
