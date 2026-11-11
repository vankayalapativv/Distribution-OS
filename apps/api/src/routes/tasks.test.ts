import { beforeEach, describe, expect, test, vi } from "vitest";
import { authHeaders, authTestEnv, installAuthFetchMock } from "../test/auth";

const SUPER_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const MANAGER_ID = "00000000-0000-4000-8000-000000000002";
const ACCOUNTANT_ID = "00000000-0000-4000-8000-000000000003";
const SE_ID = "00000000-0000-4000-8000-000000000004";
const TASK_ID = "00000000-0000-4000-8000-000000000a01";
const DONE_TASK_ID = "00000000-0000-4000-8000-000000000a02";
const ATTACHMENT_ID = "00000000-0000-4000-8000-000000000a03";

const queryLog: string[] = [];
let lastListValues: unknown[] = [];

const sampleTask = {
  id: TASK_ID,
  title: "Verify pending collections",
  description: "March batch",
  priority: "high",
  status: "open",
  dueDate: "2026-07-12",
  assignedTo: ACCOUNTANT_ID,
  assignedToName: "Asha Accountant",
  customerId: null,
  customerName: null,
  createdBy: MANAGER_ID,
  createdByName: "Mohan Manager",
  completedAt: null,
  createdAt: "2026-07-10T10:00:00.000Z",
  updatedAt: "2026-07-10T10:00:00.000Z",
};

vi.mock("@neondatabase/serverless", () => ({
  neon: () => async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join(" ");
    const tag = query.match(/\/\*\s*([a-z0-9_]+)\s*\*\//i);
    if (tag) queryLog.push(tag[1]);

    if (query.includes("auth_app_profile")) {
      const map: Record<string, { role: string; userId: string }> = {
        "neon-super-admin": { role: "SUPER_ADMIN", userId: SUPER_ADMIN_ID },
        "neon-manager": { role: "MANAGER", userId: MANAGER_ID },
        "neon-accountant": { role: "ACCOUNTANT", userId: ACCOUNTANT_ID },
        "neon-se": { role: "SALES_EXECUTIVE", userId: SE_ID },
      };
      return [map[values[0] as string] ?? map["neon-super-admin"]];
    }

    if (query.includes("list_tasks")) {
      lastListValues = values;
      return [sampleTask];
    }
    if (query.includes("create_task")) {
      return [
        values.includes(SE_ID)
          ? { ...sampleTask, assignedTo: SE_ID, assignedToName: "Suresh SE", remindAt: "2026-08-02T04:30:00.000Z" }
          : sampleTask,
      ];
    }
    if (query.includes("task_assignee_is_se")) {
      return values.includes(SE_ID) ? [{ id: SE_ID }] : [];
    }
    if (query.includes("task_se_push_tokens")) {
      return [{ token: "ExponentPushToken[test]" }];
    }
    if (query.includes("create_task_notification")) {
      return [];
    }
    if (query.includes("list_my_assigned_tasks")) {
      return values.includes(SE_ID)
        ? [
            {
              id: TASK_ID,
              title: "Call RK Automobiles",
              description: "Follow up on payment",
              priority: "high",
              status: "open",
              remindAt: "2026-08-02T04:30:00.000Z",
              customerId: null,
              customerName: "RK Automobiles",
              createdByName: "Mohan Manager",
              completedAt: null,
              updatedAt: "2026-08-01T10:00:00.000Z",
            },
          ]
        : [];
    }
    if (query.includes("get_task_for_delete")) {
      if (values.includes(DONE_TASK_ID)) {
        return [{ id: DONE_TASK_ID, status: "done", createdBy: MANAGER_ID }];
      }
      if (values.includes(TASK_ID)) {
        return [{ id: TASK_ID, status: "open", createdBy: MANAGER_ID }];
      }
      return [];
    }
    if (query.includes("task_attachment_keys_for_delete")) {
      return [];
    }
    if (query.includes("delete_task")) {
      return [];
    }
    if (query.includes("mark_my_task_done")) {
      return values.includes(SE_ID) && values.includes(TASK_ID)
        ? [{ id: TASK_ID, status: "done", completedAt: "2026-08-01T12:00:00.000Z" }]
        : [];
    }
    // Visibility rule: a task is visible only to its creator or assignee.
    // sampleTask is created by MANAGER_ID and assigned to ACCOUNTANT_ID, so
    // queries must carry the caller's userId and it must be one of those two.
    const callerVisible = values.includes(MANAGER_ID) || values.includes(ACCOUNTANT_ID);
    if (query.includes("get_task_by_id")) {
      return values.includes(TASK_ID) && callerVisible ? [sampleTask] : [];
    }
    if (query.includes("update_task")) {
      if (values.includes(DONE_TASK_ID) || !callerVisible) return [];
      return [{ ...sampleTask, status: "done", completedAt: "2026-07-10T12:00:00.000Z" }];
    }
    if (query.includes("list_task_comments")) {
      return [
        {
          id: "00000000-0000-4000-8000-000000000c01",
          body: "On it.",
          authorId: ACCOUNTANT_ID,
          authorName: "Asha Accountant",
          createdAt: "2026-07-10T11:00:00.000Z",
        },
      ];
    }
    if (query.includes("create_task_comment")) {
      return [
        {
          id: "00000000-0000-4000-8000-000000000c02",
          body: "Done by evening.",
          authorId: ACCOUNTANT_ID,
          authorName: "Asha Accountant",
          createdAt: "2026-07-10T11:30:00.000Z",
        },
      ];
    }
    if (query.includes("list_task_attachments")) {
      return [
        {
          id: ATTACHMENT_ID,
          fileName: "statement.pdf",
          contentType: "application/pdf",
          createdAt: "2026-07-10T11:00:00.000Z",
        },
      ];
    }
    if (query.includes("create_task_attachment")) {
      return [
        {
          id: ATTACHMENT_ID,
          fileName: "statement.pdf",
          contentType: "application/pdf",
          createdAt: "2026-07-10T11:00:00.000Z",
        },
      ];
    }
    if (query.includes("get_attachment_by_id")) {
      return values.includes(ATTACHMENT_ID) && callerVisible
        ? [{ id: ATTACHMENT_ID, fileKey: "tasks/x/statement.pdf", contentType: "application/pdf" }]
        : [];
    }
    if (query.includes("list_task_assignees")) {
      return [
        { id: SUPER_ADMIN_ID, name: "Vishnu", role: "SUPER_ADMIN" },
        { id: MANAGER_ID, name: "Mohan Manager", role: "MANAGER" },
        { id: ACCOUNTANT_ID, name: "Asha Accountant", role: "ACCOUNTANT" },
        { id: SE_ID, name: "Suresh SE", role: "SALES_EXECUTIVE" },
      ];
    }
    return [];
  },
}));

const r2Store = new Map<string, ArrayBuffer>();
const PHOTOS = {
  put: vi.fn(async (key: string, value: ArrayBuffer) => {
    r2Store.set(key, value);
    return {};
  }),
  get: vi.fn(async (key: string) => {
    const body = r2Store.get(key);
    if (!body) return null;
    return { body: new Blob([body]).stream(), httpMetadata: {} };
  }),
  delete: vi.fn(async () => {}),
};

const env = { DATABASE_URL: "postgresql://example.test/db", PHOTOS, ...authTestEnv };

function headers(subject: string) {
  return { "Content-Type": "application/json", ...authHeaders(subject) };
}

describe("tasks (office to-dos)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(installAuthFetchMock()));
    queryLog.length = 0;
    lastListValues = [];
    r2Store.clear();
    PHOTOS.put.mockClear();
  });

  test("each office role can list tasks; SE cannot", async () => {
    const { default: app } = await import("../index");

    for (const subject of ["neon-super-admin", "neon-manager", "neon-accountant"]) {
      const res = await app.request("/api/v1/tasks", { headers: headers(subject) }, env);
      expect(res.status).toBe(200);
    }
    const denied = await app.request("/api/v1/tasks", { headers: headers("neon-se") }, env);
    expect(denied.status).toBe(403);
  });

  test("list filters (status, assignedTo) reach the query", async () => {
    const { default: app } = await import("../index");

    const res = await app.request(
      `/api/v1/tasks?status=open&assignedTo=${ACCOUNTANT_ID}`,
      { headers: headers("neon-manager") },
      env,
    );

    expect(res.status).toBe(200);
    expect(lastListValues).toContain("open");
    expect(lastListValues).toContain(ACCOUNTANT_ID);
  });

  test("list is scoped to the caller: their userId is bound into list_tasks", async () => {
    const { default: app } = await import("../index");

    const res = await app.request("/api/v1/tasks", { headers: headers("neon-manager") }, env);

    expect(res.status).toBe(200);
    expect(lastListValues).toContain(MANAGER_ID);
  });

  test("task detail is hidden from a role that is neither creator nor assignee → 404", async () => {
    const { default: app } = await import("../index");

    // sampleTask: created by manager, assigned to accountant — super admin sees 404
    const res = await app.request(
      `/api/v1/tasks/${TASK_ID}`,
      { headers: headers("neon-super-admin") },
      env,
    );

    expect(res.status).toBe(404);
  });

  test("update, comment, and attachment download are blocked for non-participants", async () => {
    const { default: app } = await import("../index");

    const patch = await app.request(
      `/api/v1/tasks/${TASK_ID}`,
      {
        method: "PATCH",
        headers: headers("neon-super-admin"),
        body: JSON.stringify({ status: "done" }),
      },
      env,
    );
    expect(patch.status).toBe(404);

    const comment = await app.request(
      `/api/v1/tasks/${TASK_ID}/comments`,
      {
        method: "POST",
        headers: headers("neon-super-admin"),
        body: JSON.stringify({ body: "sneaky" }),
      },
      env,
    );
    expect(comment.status).toBe(404);

    const down = await app.request(
      `/api/v1/task-files/${ATTACHMENT_ID}`,
      { headers: authHeaders("neon-super-admin") },
      env,
    );
    expect(down.status).toBe(404);
  });

  test("accountant can create a task assigned to the manager", async () => {
    const { default: app } = await import("../index");

    const res = await app.request(
      "/api/v1/tasks",
      {
        method: "POST",
        headers: headers("neon-accountant"),
        body: JSON.stringify({
          title: "Verify pending collections",
          priority: "high",
          dueDate: "2026-07-12",
          assignedTo: MANAGER_ID,
        }),
      },
      env,
    );

    expect(res.status).toBe(201);
    expect(queryLog).toContain("create_task");
  });

  test("missing title → 422", async () => {
    const { default: app } = await import("../index");

    const res = await app.request(
      "/api/v1/tasks",
      { method: "POST", headers: headers("neon-manager"), body: JSON.stringify({ priority: "low" }) },
      env,
    );

    expect(res.status).toBe(422);
  });

  test("invalid priority → 422", async () => {
    const { default: app } = await import("../index");

    const res = await app.request(
      "/api/v1/tasks",
      {
        method: "POST",
        headers: headers("neon-manager"),
        body: JSON.stringify({ title: "x", priority: "urgent" }),
      },
      env,
    );

    expect(res.status).toBe(422);
  });

  test("task detail includes comments and attachments", async () => {
    const { default: app } = await import("../index");

    const res = await app.request(
      `/api/v1/tasks/${TASK_ID}`,
      { headers: headers("neon-accountant") },
      env,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.task.id).toBe(TASK_ID);
    expect(body.data.comments).toHaveLength(1);
    expect(body.data.attachments).toHaveLength(1);
  });

  test("unknown task → 404", async () => {
    const { default: app } = await import("../index");

    const res = await app.request(
      "/api/v1/tasks/00000000-0000-4000-8000-000000000a99",
      { headers: headers("neon-manager") },
      env,
    );

    expect(res.status).toBe(404);
  });

  test("status change to done goes through update_task", async () => {
    const { default: app } = await import("../index");

    const res = await app.request(
      `/api/v1/tasks/${TASK_ID}`,
      {
        method: "PATCH",
        headers: headers("neon-accountant"),
        body: JSON.stringify({ status: "done" }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("done");
    expect(queryLog).toContain("update_task");
  });

  test("invalid status → 422", async () => {
    const { default: app } = await import("../index");

    const res = await app.request(
      `/api/v1/tasks/${TASK_ID}`,
      {
        method: "PATCH",
        headers: headers("neon-manager"),
        body: JSON.stringify({ status: "archived" }),
      },
      env,
    );

    expect(res.status).toBe(422);
  });

  test("comment can be added", async () => {
    const { default: app } = await import("../index");

    const res = await app.request(
      `/api/v1/tasks/${TASK_ID}/comments`,
      {
        method: "POST",
        headers: headers("neon-accountant"),
        body: JSON.stringify({ body: "Done by evening." }),
      },
      env,
    );

    expect(res.status).toBe(201);
    expect(queryLog).toContain("create_task_comment");
  });

  test("empty comment → 422", async () => {
    const { default: app } = await import("../index");

    const res = await app.request(
      `/api/v1/tasks/${TASK_ID}/comments`,
      {
        method: "POST",
        headers: headers("neon-accountant"),
        body: JSON.stringify({ body: "   " }),
      },
      env,
    );

    expect(res.status).toBe(422);
  });

  test("attachment uploads to R2 under tasks/ and streams back", async () => {
    const { default: app } = await import("../index");

    const form = new FormData();
    form.append(
      "file",
      new File([new Uint8Array([1, 2, 3])], "statement.pdf", { type: "application/pdf" }),
    );

    const up = await app.request(
      `/api/v1/tasks/${TASK_ID}/attachments`,
      { method: "POST", headers: authHeaders("neon-manager"), body: form },
      env,
    );
    expect(up.status).toBe(201);
    expect(PHOTOS.put).toHaveBeenCalledTimes(1);
    expect((PHOTOS.put.mock.calls[0][0] as string).startsWith("tasks/")).toBe(true);

    await PHOTOS.put("tasks/x/statement.pdf", new Uint8Array([1, 2, 3]).buffer);
    const down = await app.request(
      `/api/v1/task-files/${ATTACHMENT_ID}`,
      { headers: authHeaders("neon-accountant") },
      env,
    );
    expect(down.status).toBe(200);
    expect(down.headers.get("content-type")).toBe("application/pdf");
  });

  test("assignees endpoint includes office roles and sales executives", async () => {
    const { default: app } = await import("../index");

    const res = await app.request(
      "/api/v1/tasks/assignees",
      { headers: headers("neon-manager") },
      env,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.assignees).toHaveLength(4);
    expect(body.data.assignees.some((a: { role: string }) => a.role === "SALES_EXECUTIVE")).toBe(true);
  });

  test("assigning a task to an SE persists the reminder time and notifies them", async () => {
    const { default: app } = await import("../index");

    const res = await app.request(
      "/api/v1/tasks",
      {
        method: "POST",
        headers: headers("neon-manager"),
        body: JSON.stringify({
          title: "Call RK Automobiles",
          priority: "high",
          dueDate: "2026-08-02",
          remindAt: "2026-08-02T04:30:00.000Z",
          assignedTo: SE_ID,
        }),
      },
      env,
      // Provide an execution context so the background push (waitUntil) can fire.
      { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as import("@cloudflare/workers-types").ExecutionContext,
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.assignedTo).toBe(SE_ID);
    expect(body.data.remindAt).toBe("2026-08-02T04:30:00.000Z");
    // The SE-assign path drops a row into their notification feed.
    expect(queryLog).toContain("create_task_notification");
  });

  test("SE sees their assigned tasks via /me/tasks", async () => {
    const { default: app } = await import("../index");

    const res = await app.request(
      "/api/v1/me/tasks",
      { headers: headers("neon-se") },
      env,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.tasks).toHaveLength(1);
    expect(body.data.tasks[0].customerName).toBe("RK Automobiles");
    expect(body.data.tasks[0].remindAt).toBe("2026-08-02T04:30:00.000Z");
  });

  test("office roles cannot hit the SE task feed", async () => {
    const { default: app } = await import("../index");

    const res = await app.request(
      "/api/v1/me/tasks",
      { headers: headers("neon-manager") },
      env,
    );

    expect(res.status).toBe(403);
  });

  test("creator can delete a finished (done) task", async () => {
    const { default: app } = await import("../index");

    const res = await app.request(
      `/api/v1/tasks/${DONE_TASK_ID}`,
      { method: "DELETE", headers: headers("neon-manager") },
      env,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.deleted).toBe(true);
    expect(queryLog).toContain("delete_task");
  });

  test("a non-creator cannot delete the task (404)", async () => {
    const { default: app } = await import("../index");

    const res = await app.request(
      `/api/v1/tasks/${DONE_TASK_ID}`,
      { method: "DELETE", headers: headers("neon-accountant") },
      env,
    );

    expect(res.status).toBe(404);
  });

  test("an unfinished (open) task cannot be deleted (409)", async () => {
    const { default: app } = await import("../index");

    const res = await app.request(
      `/api/v1/tasks/${TASK_ID}`,
      { method: "DELETE", headers: headers("neon-manager") },
      env,
    );

    expect(res.status).toBe(409);
  });

  test("SE marks their assigned task done", async () => {
    const { default: app } = await import("../index");

    const res = await app.request(
      `/api/v1/me/tasks/${TASK_ID}/done`,
      { method: "POST", headers: headers("neon-se") },
      env,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("done");
    expect(body.data.completedAt).toBeTruthy();
  });
});
