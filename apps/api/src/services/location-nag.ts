import type { SqlClient } from "../lib/db";

type Row = Record<string, unknown>;
const str = (v: unknown): string => {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
};

export interface LocationNagPush {
  tokens: string[];
  title: string;
  body: string;
}

export interface LocationNagResult {
  nagged: number;
  pushes: LocationNagPush[];
}

export interface LocationNagOptions {
  now?: string;
  /** Don't nag an SE again within this many minutes. */
  throttleMinutes?: number;
  /** Only nag if a heartbeat arrived within this many minutes (app is alive). */
  aliveWithinMinutes?: number;
}

const TITLE = "Turn on your location";
const BODY = "You're on duty but your location is off. Turn it back on so your route keeps recording.";

/**
 * Nag on-duty Sales Executives whose app is ALIVE (a recent heartbeat) but whose
 * location is degraded — services off, or foreground/background permission not
 * granted. A push reaches the phone even while it's pocketed, which the in-app
 * blocker can't — closing the GPS-off evasion gap. Throttled per SE via an
 * se_notifications row, and only during the SE work day (before 8 PM IST). The
 * caller (cron) sends result.pushes via sendExpoPush.
 */
export async function runLocationNag(
  sql: SqlClient,
  options: LocationNagOptions = {},
): Promise<LocationNagResult> {
  const now = options.now ?? new Date().toISOString();
  const throttle = options.throttleMinutes ?? 15;
  const alive = options.aliveWithinMinutes ?? 10;

  const targets = (await sql`
    /* find_location_off_sessions */
    select s.user_id as "seId"
    from gps_tracking_sessions s
    join executive_latest_locations ell on ell.user_id = s.user_id
    where s.status = 'active'
      and exists (
        select 1 from user_roles ur join roles r on r.id = ur.role_id
        where ur.user_id = s.user_id and r.code = 'SALES_EXECUTIVE'
      )
      and ell.last_heartbeat_at >= ${now}::timestamptz - (${alive} * interval '1 minute')
      and (
        ell.is_location_enabled is not true
        or ell.foreground_permission is distinct from 'granted'
        or ell.background_permission is distinct from 'granted'
      )
      and ${now}::timestamptz < ((s.session_date::text || ' 20:00')::timestamp at time zone s.timezone)
      and not exists (
        select 1 from se_notifications n
        where n.user_id = s.user_id and n.type = 'location_off'
          and n.created_at >= ${now}::timestamptz - (${throttle} * interval '1 minute')
      )
    limit 200
  `) as Row[];

  const seIds = targets.map((t) => str(t.seId)).filter(Boolean);
  if (seIds.length === 0) return { nagged: 0, pushes: [] };

  // Record the nag: doubles as the throttle and the SE's in-app notification.
  await sql`
    /* insert_location_nag_notifications */
    insert into se_notifications (user_id, type, title, body)
    select id, 'location_off', ${TITLE}, ${BODY}
    from unnest(${seIds}::uuid[]) as id
  `;

  const tokenRows = (await sql`
    /* location_nag_push_tokens */
    select user_id as "userId", token from push_tokens where user_id = any(${seIds}::uuid[])
  `) as Row[];

  const byUser = new Map<string, string[]>();
  for (const t of tokenRows) {
    const list = byUser.get(str(t.userId)) ?? [];
    list.push(str(t.token));
    byUser.set(str(t.userId), list);
  }

  const pushes = seIds
    .map((id) => ({ tokens: byUser.get(id) ?? [], title: TITLE, body: BODY }))
    .filter((p) => p.tokens.length > 0);

  return { nagged: seIds.length, pushes };
}
