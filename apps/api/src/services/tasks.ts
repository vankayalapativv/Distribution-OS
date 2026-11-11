import type { R2Bucket } from "@cloudflare/workers-types";
import { R2_STORAGE_CLASS } from "../lib/r2";
import type { SqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";

type Row = Record<string, unknown>;

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
}

function nullStr(v: unknown): string | null {
  const s = str(v);
  return s.length > 0 ? s : null;
}

export const TASK_PRIORITIES = new Set(["high", "medium", "low"]);
export const TASK_STATUSES = new Set(["open", "in_progress", "done", "cancelled"]);

interface TaskContext {
  userId: string;
}

function mapTaskRow(row: Row) {
  return {
    id: str(row.id),
    title: str(row.title),
    description: nullStr(row.description),
    priority: str(row.priority),
    status: str(row.status),
    dueDate: nullStr(row.dueDate)?.slice(0, 10) ?? null,
    remindAt: nullStr(row.remindAt),
    assignedTo: nullStr(row.assignedTo),
    assignedToName: nullStr(row.assignedToName),
    customerId: nullStr(row.customerId),
    customerName: nullStr(row.customerName),
    createdBy: str(row.createdBy),
    createdByName: nullStr(row.createdByName),
    completedAt: nullStr(row.completedAt),
    createdAt: str(row.createdAt),
    updatedAt: str(row.updatedAt),
  };
}

export interface ListTasksFilters {
  status?: string | null;
  priority?: string | null;
  assignedTo?: string | null;
  customerId?: string | null;
}

export async function listTasks(
  sql: SqlClient,
  context: TaskContext,
  filters: ListTasksFilters = {},
) {
  const rows = await sql`
    /* list_tasks */
    select
      t.id, t.title, t.description, t.priority, t.status,
      t.due_date as "dueDate",
      t.remind_at as "remindAt",
      t.assigned_to as "assignedTo",
      au.name as "assignedToName",
      t.customer_id as "customerId",
      c.legal_name as "customerName",
      t.created_by as "createdBy",
      cu.name as "createdByName",
      t.completed_at as "completedAt",
      t.created_at as "createdAt",
      t.updated_at as "updatedAt"
    from tasks t
    left join users au on au.id = t.assigned_to
    left join users cu on cu.id = t.created_by
    left join customers c on c.id = t.customer_id
    where (t.created_by = ${context.userId}::uuid or t.assigned_to = ${context.userId}::uuid)
      and (${filters.status ?? null}::text is null or t.status = ${filters.status ?? null})
      and (${filters.priority ?? null}::text is null or t.priority = ${filters.priority ?? null})
      and (${filters.assignedTo ?? null}::uuid is null or t.assigned_to = ${filters.assignedTo ?? null}::uuid)
      and (${filters.customerId ?? null}::uuid is null or t.customer_id = ${filters.customerId ?? null}::uuid)
    order by
      case t.status when 'open' then 0 when 'in_progress' then 1 when 'done' then 2 else 3 end,
      t.due_date nulls last,
      t.created_at desc
    limit 300
  ` as Row[];
  return rows.map(mapTaskRow);
}

export interface CreateTaskInput {
  title: string;
  description: string | null;
  priority: string;
  dueDate: string | null;
  remindAt: string | null;
  assignedTo: string | null;
  customerId: string | null;
}

/**
 * Push payload for a task assigned to a Sales Executive. Null when the task
 * isn't SE-assigned. The route fires it via ctx.waitUntil (best-effort).
 */
export interface TaskPush {
  tokens: string[];
  title: string;
  body: string;
  data: Record<string, unknown>;
}

export interface TaskWithPush {
  task: ReturnType<typeof mapTaskRow>;
  push: TaskPush | null;
}

/**
 * When a task's assignee is a Sales Executive, drop an in-app notification into
 * their feed (se_notifications, type 'task_assigned') and return the Expo push
 * payload for their devices. Returns null for office assignees / no assignee.
 */
async function notifyAssignedSe(sql: SqlClient, task: ReturnType<typeof mapTaskRow>): Promise<TaskPush | null> {
  if (!task.assignedTo) return null;

  const [se] = await sql`
    /* task_assignee_is_se */
    select u.id
    from users u
    join user_roles ur on ur.user_id = u.id
    join roles r on r.id = ur.role_id
    where u.id = ${task.assignedTo}::uuid and r.code = 'SALES_EXECUTIVE'
    limit 1
  ` as Row[];
  if (!se) return null;

  const notifTitle = "New task assigned";
  const parts = [task.title];
  if (task.customerName) parts.push(task.customerName);
  const body = parts.join(" — ");

  await sql`
    /* create_task_notification */
    insert into se_notifications (user_id, type, title, body, task_id)
    values (
      ${task.assignedTo}::uuid,
      'task_assigned',
      ${notifTitle},
      ${body},
      ${task.id}::uuid
    )
  `;

  const tokens = await sql`
    /* task_se_push_tokens */
    select token from push_tokens where user_id = ${task.assignedTo}::uuid
  ` as Row[];

  return {
    tokens: tokens.map((t) => str(t.token)).filter(Boolean),
    title: notifTitle,
    body,
    data: { type: "task_assigned", taskId: task.id },
  };
}

export async function createTask(
  sql: SqlClient,
  context: TaskContext,
  input: CreateTaskInput,
): Promise<TaskWithPush> {
  if (!TASK_PRIORITIES.has(input.priority)) {
    throw new ApiError("INVALID_FIELD", "priority must be high, medium or low.", 422);
  }

  const [row] = await sql`
    /* create_task */
    with inserted as (
      insert into tasks (
        title, description, priority, due_date, remind_at,
        assigned_to, customer_id, created_by
      ) values (
        ${input.title},
        ${input.description},
        ${input.priority},
        ${input.dueDate}::date,
        ${input.remindAt}::timestamptz,
        ${input.assignedTo}::uuid,
        ${input.customerId}::uuid,
        ${context.userId}::uuid
      )
      returning *
    )
    select
      t.id, t.title, t.description, t.priority, t.status,
      t.due_date as "dueDate",
      t.remind_at as "remindAt",
      t.assigned_to as "assignedTo",
      au.name as "assignedToName",
      t.customer_id as "customerId",
      c.legal_name as "customerName",
      t.created_by as "createdBy",
      cu.name as "createdByName",
      t.completed_at as "completedAt",
      t.created_at as "createdAt",
      t.updated_at as "updatedAt"
    from inserted t
    left join users au on au.id = t.assigned_to
    left join users cu on cu.id = t.created_by
    left join customers c on c.id = t.customer_id
  ` as Row[];

  const task = mapTaskRow(row);
  const push = await notifyAssignedSe(sql, task);
  return { task, push };
}

export async function getTaskDetail(sql: SqlClient, context: TaskContext, taskId: string) {
  const [task] = await sql`
    /* get_task_by_id */
    select
      t.id, t.title, t.description, t.priority, t.status,
      t.due_date as "dueDate",
      t.remind_at as "remindAt",
      t.assigned_to as "assignedTo",
      au.name as "assignedToName",
      t.customer_id as "customerId",
      c.legal_name as "customerName",
      t.created_by as "createdBy",
      cu.name as "createdByName",
      t.completed_at as "completedAt",
      t.created_at as "createdAt",
      t.updated_at as "updatedAt"
    from tasks t
    left join users au on au.id = t.assigned_to
    left join users cu on cu.id = t.created_by
    left join customers c on c.id = t.customer_id
    where t.id = ${taskId}::uuid
      and (t.created_by = ${context.userId}::uuid or t.assigned_to = ${context.userId}::uuid)
  ` as Row[];
  if (!task) throw new ApiError("NOT_FOUND", "Task not found.", 404);

  const comments = await sql`
    /* list_task_comments */
    select
      tc.id,
      tc.body,
      tc.author_id as "authorId",
      u.name as "authorName",
      tc.created_at as "createdAt"
    from task_comments tc
    left join users u on u.id = tc.author_id
    where tc.task_id = ${taskId}::uuid
    order by tc.created_at
  ` as Row[];

  const attachments = await sql`
    /* list_task_attachments */
    select
      id,
      file_name as "fileName",
      content_type as "contentType",
      created_at as "createdAt"
    from task_attachments
    where task_id = ${taskId}::uuid
    order by created_at
  ` as Row[];

  return {
    task: mapTaskRow(task),
    comments: comments.map((r) => ({
      id: str(r.id),
      body: str(r.body),
      authorId: nullStr(r.authorId),
      authorName: nullStr(r.authorName),
      createdAt: str(r.createdAt),
    })),
    attachments: attachments.map((r) => ({
      id: str(r.id),
      fileName: str(r.fileName),
      contentType: str(r.contentType),
      createdAt: str(r.createdAt),
    })),
  };
}

export interface UpdateTaskInput {
  title?: string | null;
  description?: string | null;
  priority?: string | null;
  status?: string | null;
  dueDate?: string | null;
  remindAt?: string | null;
  assignedTo?: string | null;
  customerId?: string | null;
}

export async function updateTask(
  sql: SqlClient,
  context: TaskContext,
  taskId: string,
  input: UpdateTaskInput,
): Promise<TaskWithPush> {
  if (input.priority != null && !TASK_PRIORITIES.has(input.priority)) {
    throw new ApiError("INVALID_FIELD", "priority must be high, medium or low.", 422);
  }
  if (input.status != null && !TASK_STATUSES.has(input.status)) {
    throw new ApiError(
      "INVALID_FIELD",
      "status must be open, in_progress, done or cancelled.",
      422,
    );
  }

  const [row] = await sql`
    /* update_task */
    with updated as (
      update tasks
      set
        title        = coalesce(${input.title ?? null}, title),
        description  = coalesce(${input.description ?? null}, description),
        priority     = coalesce(${input.priority ?? null}, priority),
        status       = coalesce(${input.status ?? null}, status),
        due_date     = coalesce(${input.dueDate ?? null}::date, due_date),
        remind_at    = coalesce(${input.remindAt ?? null}::timestamptz, remind_at),
        assigned_to  = coalesce(${input.assignedTo ?? null}::uuid, assigned_to),
        customer_id  = coalesce(${input.customerId ?? null}::uuid, customer_id),
        completed_at = case
          when ${input.status ?? null}::text = 'done' then now()
          when ${input.status ?? null}::text is not null then null
          else completed_at
        end,
        updated_at = now()
      where id = ${taskId}::uuid
        and (created_by = ${context.userId}::uuid or assigned_to = ${context.userId}::uuid)
      returning *
    )
    select
      t.id, t.title, t.description, t.priority, t.status,
      t.due_date as "dueDate",
      t.remind_at as "remindAt",
      t.assigned_to as "assignedTo",
      au.name as "assignedToName",
      t.customer_id as "customerId",
      c.legal_name as "customerName",
      t.created_by as "createdBy",
      cu.name as "createdByName",
      t.completed_at as "completedAt",
      t.created_at as "createdAt",
      t.updated_at as "updatedAt"
    from updated t
    left join users au on au.id = t.assigned_to
    left join users cu on cu.id = t.created_by
    left join customers c on c.id = t.customer_id
  ` as Row[];

  if (!row) throw new ApiError("NOT_FOUND", "Task not found.", 404);
  const task = mapTaskRow(row);
  // Only ping the SE on an explicit (re)assignment — not on every status/date edit.
  const push = input.assignedTo ? await notifyAssignedSe(sql, task) : null;
  return { task, push };
}

/**
 * Permanently delete a finished task. Creator-only, and only a done/cancelled
 * task can be removed. task_comments, task_attachments and se_notifications rows
 * cascade via their FKs; the attachment blobs in R2 are deleted explicitly here
 * (R2 objects don't cascade with the DB rows).
 */
export async function deleteTask(
  sql: SqlClient,
  bucket: R2Bucket,
  context: TaskContext,
  taskId: string,
) {
  const [task] = await sql`
    /* get_task_for_delete */
    select t.id, t.status, t.title, t.created_by as "createdBy"
    from tasks t
    where t.id = ${taskId}::uuid
  ` as Row[];
  // Creator-only: hide the task's existence from anyone else (mirrors the 404
  // used everywhere else for non-participants).
  if (!task || nullStr(task.createdBy) !== context.userId) {
    throw new ApiError("NOT_FOUND", "Task not found.", 404);
  }
  if (str(task.status) !== "done" && str(task.status) !== "cancelled") {
    throw new ApiError(
      "CONFLICT",
      "Only completed or cancelled tasks can be deleted.",
      409,
    );
  }

  const attachments = await sql`
    /* task_attachment_keys_for_delete */
    select file_key as "fileKey" from task_attachments where task_id = ${taskId}::uuid
  ` as Row[];
  for (const a of attachments) {
    await bucket.delete(str(a.fileKey)).catch(() => undefined);
  }

  await sql`
    /* delete_task */
    delete from tasks where id = ${taskId}::uuid and created_by = ${context.userId}::uuid
  `;
  return { deleted: true, id: taskId, title: str(task.title) };
}

export async function addTaskComment(
  sql: SqlClient,
  context: TaskContext,
  taskId: string,
  body: string,
) {
  const [task] = await sql`
    /* get_task_by_id */
    select t.id from tasks t
    where t.id = ${taskId}::uuid
      and (t.created_by = ${context.userId}::uuid or t.assigned_to = ${context.userId}::uuid)
  ` as Row[];
  if (!task) throw new ApiError("NOT_FOUND", "Task not found.", 404);

  const [row] = await sql`
    /* create_task_comment */
    with inserted as (
      insert into task_comments (task_id, author_id, body)
      values (
        ${taskId}::uuid,
        ${context.userId}::uuid,
        ${body}
      )
      returning *
    )
    select
      tc.id, tc.body,
      tc.author_id as "authorId",
      u.name as "authorName",
      tc.created_at as "createdAt"
    from inserted tc
    left join users u on u.id = tc.author_id
  ` as Row[];

  return {
    id: str(row.id),
    body: str(row.body),
    authorId: nullStr(row.authorId),
    authorName: nullStr(row.authorName),
    createdAt: str(row.createdAt),
  };
}

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024; // 15 MB

export async function addTaskAttachment(
  sql: SqlClient,
  bucket: R2Bucket,
  context: TaskContext,
  taskId: string,
  file: File,
) {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new ApiError("INVALID_FIELD", "Attachment must be under 15 MB.", 422);
  }

  const [task] = await sql`
    /* get_task_by_id */
    select t.id from tasks t
    where t.id = ${taskId}::uuid
      and (t.created_by = ${context.userId}::uuid or t.assigned_to = ${context.userId}::uuid)
  ` as Row[];
  if (!task) throw new ApiError("NOT_FOUND", "Task not found.", 404);

  const safeName = file.name.replace(/[^\w.\-]/g, "_").slice(0, 120) || "file";
  const fileKey = `tasks/${taskId}/${crypto.randomUUID()}-${safeName}`;
  const contentType = file.type || "application/octet-stream";

  await bucket.put(fileKey, await file.arrayBuffer(), {
    httpMetadata: { contentType },
    storageClass: R2_STORAGE_CLASS,
  });

  const [row] = await sql`
    /* create_task_attachment */
    insert into task_attachments (
      task_id, uploaded_by, file_name, file_key, content_type, size_bytes
    ) values (
      ${taskId}::uuid,
      ${context.userId}::uuid,
      ${file.name},
      ${fileKey},
      ${contentType},
      ${file.size}
    )
    returning
      id,
      file_name as "fileName",
      content_type as "contentType",
      created_at as "createdAt"
  ` as Row[];

  return {
    id: str(row.id),
    fileName: str(row.fileName),
    contentType: str(row.contentType),
    createdAt: str(row.createdAt),
  };
}

export async function getAttachmentStream(
  sql: SqlClient,
  bucket: R2Bucket,
  context: TaskContext,
  attachmentId: string,
): Promise<{ body: ReadableStream; contentType: string; fileName: string }> {
  const [attachment] = await sql`
    /* get_attachment_by_id */
    select ta.id, ta.file_key as "fileKey", ta.content_type as "contentType", ta.file_name as "fileName"
    from task_attachments ta
    join tasks t on t.id = ta.task_id
    where ta.id = ${attachmentId}::uuid
      and (t.created_by = ${context.userId}::uuid or t.assigned_to = ${context.userId}::uuid)
  ` as Row[];
  if (!attachment) throw new ApiError("NOT_FOUND", "Attachment not found.", 404);

  const object = await bucket.get(str(attachment.fileKey));
  if (!object) throw new ApiError("NOT_FOUND", "Attachment file is missing from storage.", 404);

  return {
    body: object.body as unknown as ReadableStream,
    contentType: str(attachment.contentType) || "application/octet-stream",
    fileName: str(attachment.fileName),
  };
}

export async function listTaskAssignees(sql: SqlClient) {
  // Office roles (assign to each other) + Sales Executives (assign field tasks
  // that surface in the mobile Reminders tab). SE rows carry role
  // 'SALES_EXECUTIVE' so the web can group them and require a reminder time.
  const rows = await sql`
    /* list_task_assignees */
    select u.id, u.name,
      case when bool_or(r.code = 'SUPER_ADMIN') then 'SUPER_ADMIN'
           when bool_or(r.code = 'MANAGER') then 'MANAGER'
           when bool_or(r.code = 'ACCOUNTANT') then 'ACCOUNTANT'
           else 'SALES_EXECUTIVE' end as role
    from users u
    join user_roles ur on ur.user_id = u.id
    join roles r on r.id = ur.role_id
    where u.status = 'active'
    group by u.id, u.name
    having bool_or(r.code in ('SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT', 'SALES_EXECUTIVE'))
    order by
      case when bool_or(r.code in ('SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT')) then 0 else 1 end,
      u.name
  ` as Row[];
  return rows.map((r) => ({ id: str(r.id), name: str(r.name), role: str(r.role) }));
}

/**
 * Sales-Executive view of the tasks assigned to them (mobile Reminders tab).
 * Only SE-assigned rows (remind_at set), and only ones still actionable or
 * recently completed, so a just-finished task doesn't vanish instantly.
 */
export async function listMyAssignedTasks(sql: SqlClient, context: TaskContext) {
  const rows = await sql`
    /* list_my_assigned_tasks */
    select
      t.id, t.title, t.description, t.priority, t.status,
      t.remind_at as "remindAt",
      t.customer_id as "customerId",
      c.legal_name as "customerName",
      cu.name as "createdByName",
      t.completed_at as "completedAt",
      t.updated_at as "updatedAt"
    from tasks t
    left join users cu on cu.id = t.created_by
    left join customers c on c.id = t.customer_id
    where t.assigned_to = ${context.userId}::uuid
      and t.remind_at is not null
      and (
        t.status in ('open', 'in_progress')
        or (t.status = 'done' and t.completed_at > now() - interval '2 days')
      )
    order by t.remind_at
    limit 200
  ` as Row[];
  return rows.map((r) => ({
    id: str(r.id),
    title: str(r.title),
    description: nullStr(r.description),
    priority: str(r.priority),
    status: str(r.status),
    remindAt: nullStr(r.remindAt),
    customerId: nullStr(r.customerId),
    customerName: nullStr(r.customerName),
    createdByName: nullStr(r.createdByName),
    completedAt: nullStr(r.completedAt),
    updatedAt: str(r.updatedAt),
  }));
}

/** SE marks their assigned task done → two-way status the office sees on web. */
export async function markMyTaskDone(sql: SqlClient, context: TaskContext, taskId: string) {
  const [row] = await sql`
    /* mark_my_task_done */
    update tasks
    set status = 'done', completed_at = now(), updated_at = now()
    where id = ${taskId}::uuid
      and assigned_to = ${context.userId}::uuid
    returning id, status, completed_at as "completedAt"
  ` as Row[];
  if (!row) throw new ApiError("NOT_FOUND", "Task not found.", 404);
  return { id: str(row.id), status: str(row.status), completedAt: nullStr(row.completedAt) };
}
