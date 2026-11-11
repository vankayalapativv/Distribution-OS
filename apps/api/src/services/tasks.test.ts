import { describe, expect, it, vi } from "vitest";
import { addTaskAttachment, deleteTask, updateTask } from "./tasks";
import { makeSql, calledTag } from "../test/sql-mock";

const CTX = { userId: "u1", role: "MANAGER" } as never;
const bucket = { delete: vi.fn().mockResolvedValue(undefined), put: vi.fn() };
const B = bucket as never;

describe("tasks", () => {
  it("updateTask rejects an invalid priority (422, before DB)", async () => {
    await expect(updateTask(makeSql(), CTX, "t1", { priority: "urgent" } as never)).rejects.toMatchObject({ status: 422 });
  });
  it("addTaskAttachment rejects an oversize file (422)", async () => {
    const big = { type: "image/png", size: 16 * 1024 * 1024, arrayBuffer: async () => new ArrayBuffer(4) } as unknown as File;
    await expect(addTaskAttachment(makeSql(), B, CTX, "t1", big)).rejects.toMatchObject({ status: 422 });
  });
  it("deleteTask removes bill objects and the row for a completed task", async () => {
    const sql = makeSql({
      get_task_for_delete: [{ id: "t1", status: "done", title: "T", createdBy: "u1" }],
      task_attachment_keys_for_delete: [{ fileKey: "k1" }],
      delete_task: [],
    });
    const res = await deleteTask(sql, B, CTX, "t1");
    expect(res).toMatchObject({ deleted: true, id: "t1" });
    expect(bucket.delete).toHaveBeenCalledWith("k1");
    expect(calledTag(sql, "delete_task")).toBe(true);
  });
  it("deleteTask 404s a non-creator and 409s a still-open task", async () => {
    await expect(deleteTask(makeSql({ get_task_for_delete: [{ id: "t1", status: "done", createdBy: "other" }] }), B, CTX, "t1")).rejects.toMatchObject({ status: 404 });
    await expect(deleteTask(makeSql({ get_task_for_delete: [{ id: "t1", status: "open", createdBy: "u1" }] }), B, CTX, "t1")).rejects.toMatchObject({ status: 409 });
  });
});
