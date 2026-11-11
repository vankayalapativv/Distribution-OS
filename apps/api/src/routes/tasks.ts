import type { R2Bucket } from "@cloudflare/workers-types";
import { waitUntilSafe } from "../lib/wait-until";
import { Hono, type Context } from "hono";
import { success } from "../lib/api-response";
import { requireRole } from "../lib/authz";
import { actorOf, logAudit } from "../services/audit";
import { getSqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";
import {
  optionalString,
  readJsonObject,
  requiredString,
} from "../lib/request-body";
import {
  addTaskAttachment,
  addTaskComment,
  createTask,
  deleteTask,
  getAttachmentStream,
  getTaskDetail,
  listTaskAssignees,
  listTasks,
  updateTask,
  type TaskPush,
} from "../services/tasks";
import { sendExpoPush } from "../services/invoices";
import type { ApiEnv } from "../types";

/** Tasks are an office feature: web dashboard roles only, never SEs. */
const OFFICE_ROLES = ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"] as const;

function requireBucket(bucket: R2Bucket | undefined): R2Bucket {
  if (!bucket) {
    throw new ApiError("CONFIG", "File storage is not configured.", 500);
  }
  return bucket;
}

/** Fire the SE "task assigned" push in the background (best-effort). */
function firePush(c: Context<ApiEnv>, push: TaskPush | null) {
  if (push && push.tokens.length > 0) {
    waitUntilSafe(c, sendExpoPush(push.tokens, push.title, push.body, push.data));
  }
}

export const tasksRoutes = new Hono<ApiEnv>()
  .get("/assignees", async (c) => {
    requireRole(c, [...OFFICE_ROLES]);
    const assignees = await listTaskAssignees(getSqlClient(c));
    return c.json(success(c, { assignees }));
  })
  .get("/", async (c) => {
    const auth = requireRole(c, [...OFFICE_ROLES]);
    const { status, priority, assignedTo, customerId } = c.req.query();
    const tasks = await listTasks(getSqlClient(c), { userId: auth.userId! }, {
      status: status ?? null,
      priority: priority ?? null,
      assignedTo: assignedTo ?? null,
      customerId: customerId ?? null,
    });
    return c.json(success(c, { tasks }));
  })
  .post("/", async (c) => {
    const auth = requireRole(c, [...OFFICE_ROLES]);
    const body = await readJsonObject(c);

    const sql = getSqlClient(c);
    const { task, push } = await createTask(
      sql,
      { userId: auth.userId! },
      {
        title: requiredString(body, "title"),
        description: optionalString(body, "description"),
        priority: optionalString(body, "priority") ?? "medium",
        dueDate: optionalString(body, "dueDate"),
        remindAt: optionalString(body, "remindAt"),
        assignedTo: optionalString(body, "assignedTo"),
        customerId: optionalString(body, "customerId"),
      },
    );
    await logAudit(sql, actorOf(auth), {
      action: "task.create",
      entityType: "task",
      entityId: task.id,
      entityLabel: task.title,
      summary: `Created task "${task.title}"`,
    });
    firePush(c, push);
    return c.json(success(c, task), 201);
  })
  .get("/:id", async (c) => {
    const auth = requireRole(c, [...OFFICE_ROLES]);
    const detail = await getTaskDetail(
      getSqlClient(c),
      { userId: auth.userId! },
      c.req.param("id"),
    );
    return c.json(success(c, detail));
  })
  .patch("/:id", async (c) => {
    const auth = requireRole(c, [...OFFICE_ROLES]);
    const body = await readJsonObject(c);

    const sql = getSqlClient(c);
    const { task, push } = await updateTask(
      sql,
      { userId: auth.userId! },
      c.req.param("id"),
      {
        title: optionalString(body, "title"),
        description: optionalString(body, "description"),
        priority: optionalString(body, "priority"),
        status: optionalString(body, "status"),
        dueDate: optionalString(body, "dueDate"),
        remindAt: optionalString(body, "remindAt"),
        assignedTo: optionalString(body, "assignedTo"),
        customerId: optionalString(body, "customerId"),
      },
    );
    await logAudit(sql, actorOf(auth), {
      action: "task.update",
      entityType: "task",
      entityId: task.id,
      entityLabel: task.title,
      summary: `Updated task "${task.title}"${task.status ? ` (${task.status})` : ""}`,
    });
    firePush(c, push);
    return c.json(success(c, task));
  })
  .delete("/:id", async (c) => {
    const auth = requireRole(c, [...OFFICE_ROLES]);
    const bucket = requireBucket(c.env.PHOTOS);
    const sql = getSqlClient(c);
    const result = await deleteTask(sql, bucket, { userId: auth.userId! }, c.req.param("id"));
    await logAudit(sql, actorOf(auth), {
      action: "task.delete",
      entityType: "task",
      entityId: result.id,
      entityLabel: result.title,
      summary: `Deleted task "${result.title}"`,
    });
    return c.json(success(c, result));
  })
  .post("/:id/comments", async (c) => {
    const auth = requireRole(c, [...OFFICE_ROLES]);
    const body = await readJsonObject(c);
    const text = optionalString(body, "body")?.trim();
    if (!text) {
      throw new ApiError("INVALID_FIELD", "Comment body is required.", 422);
    }

    const sql = getSqlClient(c);
    const comment = await addTaskComment(sql, { userId: auth.userId! }, c.req.param("id"), text);
    await logAudit(sql, actorOf(auth), {
      action: "task.comment",
      entityType: "task",
      entityId: c.req.param("id"),
      summary: "Commented on a task",
    });
    return c.json(success(c, comment), 201);
  })
  .post("/:id/attachments", async (c) => {
    const auth = requireRole(c, [...OFFICE_ROLES]);
    const bucket = requireBucket(c.env.PHOTOS);

    const form = await c.req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new ApiError("INVALID_FIELD", "Attach the file as the 'file' form field.", 422);
    }

    const sql = getSqlClient(c);
    const attachment = await addTaskAttachment(
      sql,
      bucket,
      { userId: auth.userId! },
      c.req.param("id"),
      file,
    );
    await logAudit(sql, actorOf(auth), {
      action: "task.attachment",
      entityType: "task",
      entityId: c.req.param("id"),
      summary: "Added an attachment to a task",
    });
    return c.json(success(c, attachment), 201);
  });

/** Binary streaming for attachments: /task-files/:attachmentId */
export const taskFilesRoutes = new Hono<ApiEnv>().get("/:attachmentId", async (c) => {
  const auth = requireRole(c, [...OFFICE_ROLES]);
  const bucket = requireBucket(c.env.PHOTOS);

  const { body, contentType, fileName } = await getAttachmentStream(
    getSqlClient(c),
    bucket,
    { userId: auth.userId! },
    c.req.param("attachmentId"),
  );

  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=86400",
    },
  });
});
