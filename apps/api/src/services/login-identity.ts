import type { SqlClient } from "../lib/db";

/**
 * Resolve a login identifier (email OR phone number) to the account email that
 * Neon Auth signs in with. Users authenticate by email + password against Neon;
 * phone login is a lookup bridge on top of that — the same single password.
 *
 * - An identifier containing "@" is treated as an email and passes through.
 * - Otherwise it is a phone number: matched on its **last 10 digits** against
 *   `users.phone` (so `+91…`, `0…`, spaces/dashes all resolve). A single match
 *   resolves (regardless of status, so a deactivated user still reaches the
 *   password check and gets the clear "account deactivated" message rather than
 *   a confusing generic 401). When several accounts share the last 10 digits it
 *   prefers the one active account; a genuinely ambiguous match (and an unknown
 *   or too-short number) returns null, so the caller answers with the same
 *   generic "invalid credentials" as a wrong password — no enumeration.
 *
 * Status is NOT filtered here: whether the account may sign in is decided after
 * the password is verified, by the /auth/login handler (see routes/auth.ts), so
 * email and phone treat a deactivated account identically.
 */
export async function resolveSignInEmail(
  sql: SqlClient,
  identifier: string,
): Promise<string | null> {
  const id = identifier.trim();
  if (id.includes("@")) return id;

  const digits = id.replace(/\D/g, "").slice(-10);
  if (digits.length < 10) return null;

  const rows = (await sql`
    /* login_resolve_email_by_phone */
    select email, status
    from users
    where right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 10) = ${digits}
      and email is not null
      and email <> ''
    limit 3
  `) as Array<{ email: string; status: string }>;

  if (rows.length === 0) return null; // unknown number
  if (rows.length === 1) return rows[0].email || null;
  // Several accounts share the number — resolve only if exactly one is active.
  const active = rows.filter((r) => r.status === "active");
  return active.length === 1 ? active[0].email || null : null;
}
