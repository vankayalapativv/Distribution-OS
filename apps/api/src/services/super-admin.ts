import { ApiError } from "../lib/errors";
import type { SqlClient } from "../lib/db";
import type { Role } from "../types";

interface SuperAdminContext {
  userId: string;
}

interface CreateUserInput {
  name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  /**
   * Neon Auth user id to link this account to (users.app_login_id). When set,
   * the credential lives in Neon Auth — we store NO local password. Legacy
   * callers omit it and get a generated PBKDF2 password (kept until cutover).
   */
  appLoginId?: string | null;
}

type Row = Record<string, unknown>;

/**
 * No hard cap on user accounts — the team can grow freely. Billing seat counts
 * are handled manually (Razorpay does not allow changing quantity on the current
 * card-based subscription). The advisory lock below still serializes concurrent
 * creates.
 */
const USER_CREATE_LOCK_KEY = 428135;

const setupRoles = new Set<Role>([
  "SUPER_ADMIN",
  "MANAGER",
  "ACCOUNTANT",
  "SALES_EXECUTIVE",
  "LOGISTICS",
]);

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableStringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function firstRow(rows: Row[]): Row {
  return rows[0] ?? {};
}

function parseRoles(value: unknown): Role[] {
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }

  return value
    .split(",")
    .map((role) => role.trim())
    .filter((role): role is Role => setupRoles.has(role as Role));
}

export async function getSuperAdminSetup(
  sql: SqlClient,
  context: SuperAdminContext,
) {
  const users = await sql`
    /* super_admin_setup_users */
    select
      u.id,
      u.name,
      u.email,
      u.phone,
      u.status,
      u.app_login_id as "appLoginId",
      coalesce(string_agg(r.code, ',' order by r.code), '') as roles
    from users u
    left join user_roles ur on ur.user_id = u.id
    left join roles r on r.id = ur.role_id
    group by u.id, u.name, u.email, u.phone, u.status, u.app_login_id
    order by u.created_at desc, u.name
  `;

  return {
    role: "SUPER_ADMIN",
    users: users.map((row) => ({
      id: stringValue(row.id),
      name: stringValue(row.name),
      email: nullableStringValue(row.email),
      phone: nullableStringValue(row.phone),
      status: stringValue(row.status),
      appLoginId: nullableStringValue(row.appLoginId),
      roles: parseRoles(row.roles),
    })),
  };
}

export async function createSuperAdminUser(
  sql: SqlClient,
  context: SuperAdminContext,
  input: CreateUserInput,
) {
  if (!setupRoles.has(input.role)) {
    throw new ApiError("INVALID_ROLE", "role is not supported.", 422);
  }

  const role = firstRow(
    await sql`
      /* super_admin_role_lookup */
      select id
      from roles
      where code = ${input.role}
      limit 1
    `,
  );

  const roleId = stringValue(role.id);

  if (!roleId) {
    throw new ApiError("ROLE_NOT_FOUND", "Requested role was not found.", 422);
  }

  // No user cap (seat-based billing). The advisory xact lock still serializes
  // concurrent creates, and the role assignment rides the same transaction so a
  // failed insert writes nothing. Identity + credential live in Neon Auth; the
  // app row only links via app_login_id. The new user starts active, so the
  // route re-syncs the subscription seat count afterwards.
  const results = await sql.transaction([
    sql`select pg_advisory_xact_lock(${USER_CREATE_LOCK_KEY})`,
    sql`
      /* super_admin_create_user */
      with ins as (
        insert into users (name, email, phone, app_login_id, status)
        values (${input.name}, ${input.email}, ${input.phone}, ${input.appLoginId ?? null}, 'active')
        returning id, name, email, phone, status
      ), role_assign as (
        insert into user_roles (user_id, role_id, assigned_by)
        select id, ${roleId}::uuid, ${context.userId}::uuid from ins
        on conflict (user_id, role_id) do nothing
      )
      select id, name, email, phone, status from ins
    `,
  ]);

  const user = firstRow(results[1] as Row[]);

  return {
    id: stringValue(user.id),
    name: stringValue(user.name),
    email: nullableStringValue(user.email),
    phone: nullableStringValue(user.phone),
    status: stringValue(user.status),
    role: input.role,
  };
}

interface UpdateUserInput {
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
}

const USER_STATUSES = new Set(["active", "inactive"]);

/** Roles held by a user, used to protect SUPER_ADMIN accounts. */
async function rolesForUser(sql: SqlClient, userId: string): Promise<string[]> {
  const rows = (await sql`
    /* super_admin_user_roles */
    select r.code
    from user_roles ur
    join roles r on r.id = ur.role_id
    where ur.user_id = ${userId}::uuid
  `) as Row[];
  return rows.map((r) => stringValue(r.code));
}

async function requireExistingUser(sql: SqlClient, userId: string): Promise<Row> {
  const rows = (await sql`
    /* super_admin_get_user */
    select id, name, email, phone, status
    from users
    where id = ${userId}::uuid
    limit 1
  `) as Row[];
  const user = rows[0];
  if (!user) throw new ApiError("NOT_FOUND", "User not found.", 404);
  return user;
}

/**
 * Edits a user's identity and login status. Deliberately does NOT touch role —
 * changing what someone can do is a separate concern from fixing their details.
 *
 * Note the business decision behind this (2026-07-24): when an SE leaves, the
 * Super Admin re-uses their account for the replacement by editing these fields
 * and setting a new password. Historical orders/collections stay attached to the
 * same user id, so past work is then attributed to the new holder — accepted by
 * the client with that trade-off understood.
 */
export async function updateSuperAdminUser(
  sql: SqlClient,
  _context: SuperAdminContext,
  userId: string,
  input: UpdateUserInput,
) {
  if (!input.name.trim()) {
    throw new ApiError("VALIDATION", "Name is required.", 422);
  }
  if (!USER_STATUSES.has(input.status)) {
    throw new ApiError("VALIDATION", "Status must be active or inactive.", 422);
  }

  await requireExistingUser(sql, userId);

  // email and phone are UNIQUE — surface a clean conflict instead of a 500.
  const clashes = (await sql`
    /* super_admin_user_unique_check */
    select id
    from users
    where id <> ${userId}::uuid
      and (
        (${input.email}::text is not null and email = ${input.email})
        or (${input.phone}::text is not null and phone = ${input.phone})
      )
    limit 1
  `) as Row[];
  if (clashes.length > 0) {
    throw new ApiError("CONFLICT", "Another user already has that email or phone.", 409);
  }

  const user = firstRow(
    await sql`
      /* super_admin_update_user */
      update users set
        name = ${input.name.trim()},
        email = ${input.email},
        phone = ${input.phone},
        status = ${input.status},
        updated_at = now()
      where id = ${userId}::uuid
      returning id, name, email, phone, status
    `,
  );

  const roles = await rolesForUser(sql, userId);
  return {
    id: stringValue(user.id),
    name: stringValue(user.name),
    email: nullableStringValue(user.email),
    phone: nullableStringValue(user.phone),
    status: stringValue(user.status),
    role: roles[0] ?? null,
  };
}

/**
 * Latest known mobile device for a user, from the tracking heartbeats the app
 * sends (manufacturer + model + Android version). Used to label the user's
 * mobile sessions with a real device name instead of just "Mobile app". Returns
 * null when the user has never sent a heartbeat (e.g. web-only accounts).
 */
export async function getUserLatestDevice(sql: SqlClient, userId: string) {
  // Primary source: the push-token the app registers on EVERY login (all roles).
  let row = firstRow(
    await sql`
      /* user_device_from_push */
      select manufacturer, model, null::text as "androidVersion", updated_at as "lastSeenAt"
      from push_tokens
      where user_id = ${userId}::uuid and (manufacturer is not null or model is not null)
      order by updated_at desc
      limit 1
    `,
  );
  // Fallback: the richer field-tracking heartbeat (SE/Logistics only).
  if (!nullableStringValue(row.manufacturer) && !nullableStringValue(row.model)) {
    row = firstRow(
      await sql`
        /* user_device_from_tracking */
        select manufacturer, model, android_version as "androidVersion", captured_at as "lastSeenAt"
        from tracking_device_heartbeats
        where user_id = ${userId}::uuid
        order by captured_at desc
        limit 1
      `,
    );
  }
  const manufacturer = nullableStringValue(row.manufacturer);
  const model = nullableStringValue(row.model);
  if (!manufacturer && !model) return null;
  return {
    manufacturer,
    model,
    androidVersion: nullableStringValue(row.androidVersion),
    label: [manufacturer, model].filter(Boolean).join(" "),
  };
}
