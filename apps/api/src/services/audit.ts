import type { SqlClient } from "../lib/db";
import type { AuthContext } from "../types";

/** Who performed the action (from the request auth context). */
export interface AuditActor {
  userId: string | null;
  email: string | null;
  role: string | null;
}

/** Build an audit actor from a resolved auth context. */
export function actorOf(auth: AuthContext): AuditActor {
  return { userId: auth.userId, email: auth.email, role: auth.role };
}

export interface AuditEvent {
  /** Stable dotted verb, e.g. "collection.verify", "order.create". */
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  entityLabel?: string | null;
  summary: string;
  metadata?: Record<string, unknown> | null;
}

/**
 * Record one audit-log entry. Best-effort and inline-after-success: it swallows
 * its own errors so a logging failure can never break the action being audited
 * (call it only AFTER that action has committed). The actor's current name is
 * snapshotted via a subselect so the entry stays readable even if the user is
 * later renamed or deleted; the email is the fallback label.
 */
export async function logAudit(
  sql: SqlClient,
  actor: AuditActor,
  event: AuditEvent,
): Promise<void> {
  try {
    await sql`
      /* insert_audit_log */
      insert into audit_logs (
        actor_user_id, actor_name, actor_role,
        action, entity_type, entity_id, entity_label, summary, metadata
      )
      values (
        ${actor.userId ?? null}::uuid,
        coalesce(
          (select name from users where id = ${actor.userId ?? null}::uuid),
          ${actor.email ?? "System"}
        ),
        ${actor.role ?? null},
        ${event.action},
        ${event.entityType ?? null},
        ${event.entityId ?? null}::uuid,
        ${event.entityLabel ?? null},
        ${event.summary},
        ${event.metadata ? JSON.stringify(event.metadata) : null}::jsonb
      )
    `;
  } catch (err) {
    console.error("[audit] failed to record event", event.action, err);
  }
}
