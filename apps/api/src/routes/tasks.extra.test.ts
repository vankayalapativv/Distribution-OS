import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, headers, installAuth } from "../test/route-harness";
vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => ({})) };
});
vi.mock("../lib/wait-until", () => ({ waitUntilSafe: vi.fn() }));
vi.mock("../services/audit", () => ({ actorOf: () => ({}), logAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../services/invoices", () => ({ sendExpoPush: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../services/tasks", () => ({
  addTaskAttachment: vi.fn().mockResolvedValue({ id: "att1" }),
  addTaskComment: vi.fn().mockResolvedValue({ id: "cm1" }),
  createTask: vi.fn().mockResolvedValue({ task: { id: "t1", title: "x" }, push: null }),
  deleteTask: vi.fn().mockResolvedValue({ id: "t1", title: "x" }),
  getAttachmentStream: vi.fn().mockResolvedValue({ body: new Uint8Array([1]), contentType: "image/jpeg", fileName: "f.jpg" }),
  getTaskDetail: vi.fn().mockResolvedValue({ task: {} }),
  listTaskAssignees: vi.fn().mockResolvedValue([]),
  listTasks: vi.fn().mockResolvedValue([]),
  updateTask: vi.fn().mockResolvedValue({ task: { id: "t1", title: "x" }, push: null }),
}));
const envBucket = { ...ENV, PHOTOS: { get: vi.fn(), put: vi.fn() } };
beforeEach(() => { vi.resetModules(); installAuth(); });
const app = () => import("../index").then((m) => m.default);
describe("tasks storage-gated handlers", () => {
  it("DELETE /:id — 500 when storage missing", async () => {
    expect((await (await app()).request("/api/v1/tasks/t1", { method: "DELETE", headers: headers("manager") }, ENV)).status).toBe(500);
  });
  it("POST /:id/attachments — 422 when no file is attached", async () => {
    const h = { ...headers("manager") } as Record<string, string>;
    delete h["Content-Type"];
    const request = new Request("http://local/api/v1/tasks/t1/attachments", { method: "POST", headers: h, body: new FormData() });
    expect((await (await app()).request(request, undefined, envBucket)).status).toBe(422);
  });
});
