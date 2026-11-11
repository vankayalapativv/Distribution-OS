import type { SqlClient } from "../lib/db";
import { ApiError } from "../lib/api-error";

type Row = Record<string, unknown>;
const str = (v: unknown) => {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
};
const nullableStr = (v: unknown) => (str(v).length > 0 ? str(v) : null);

export interface MyProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

function mapProfile(row: Row): MyProfile {
  return { id: str(row.id), name: str(row.name), email: nullableStr(row.email), phone: nullableStr(row.phone) };
}

export async function getMyProfile(sql: SqlClient, userId: string): Promise<MyProfile> {
  const [row] = (await sql`
    /* me_profile */
    select id, name, email, phone from users where id = ${userId}::uuid
  `) as Row[];
  if (!row) throw new ApiError("NOT_FOUND", "User not found.", 404);
  return mapProfile(row);
}

export async function updateMyProfile(
  sql: SqlClient,
  userId: string,
  input: { name?: string | null; phone?: string | null },
): Promise<MyProfile> {
  let row: Row | undefined;
  try {
    [row] = (await sql`
      /* update_me_profile */
      update users
      set name = coalesce(${input.name ?? null}, name),
          phone = coalesce(${input.phone ?? null}, phone),
          updated_at = now()
      where id = ${userId}::uuid
      returning id, name, email, phone
    `) as Row[];
  } catch (e) {
    // users has `unique (phone)` — surface a clashing phone (23505) as a 409.
    const message = e instanceof Error ? e.message : "";
    if (/23505|duplicate key|unique constraint/i.test(message)) {
      throw new ApiError("CONFLICT", "That phone number is already used by another account.", 409);
    }
    throw e;
  }
  if (!row) throw new ApiError("NOT_FOUND", "User not found.", 404);
  return mapProfile(row);
}
