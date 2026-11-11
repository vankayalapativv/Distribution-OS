import type { SqlClient } from "../lib/db";

/**
 * Resolve a login identifier (email OR phone number) to the account email that
 * Neon Auth signs in with. Users authenticate by email + password against Neon;
 * phone login is a lookup bridge on top of that — the same single password.
 *
 * - An identifier containing "@" is treated as an email and passes through.
 * - Otherwise it is a phone number: matched on its **last 10 digits** against
 *   `users.phone` (so `+91…`, `0…`, spaces/dashes all resolve), restricted to a
 *   single **active** user with an email. Zero matches, a too-short number, or
 *   an ambiguous match (two active users share the last 10 digits) all return
 *   null — the caller then answers with the same generic "invalid credentials"
 *   as a wrong password, so phone numbers can't be enumerated and nobody is
 *   signed into the wrong account.
 */
export async function resolveSignInEmail(
  sql: SqlClient,
  identifier: string,
): Promise<string | null> {
  const id = identifier.trim();
  if (id.includes("@")) return id;

  const digits = id.replace(/\D/g, "").slice(-10);
  if (digits.length < 10) return null;

  const rows = await sql`
    /* login_resolve_email_by_phone */
    select email
    from users
    where right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 10) = ${digits}
      and status = 'active'
      and email is not null
      and email <> ''
    limit 2
  `;
  if (rows.length !== 1) return null; // 0 = unknown, >1 = ambiguous → fail safe
  const email = rows[0]?.email;
  return typeof email === "string" && email ? email : null;
}
