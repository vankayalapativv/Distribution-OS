import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiRequest = vi.fn();
vi.mock("@/lib/api-client", () => ({
  apiRequest: (...a: unknown[]) => apiRequest(...a),
  errorMessage: (_e: unknown, fallback: string) => fallback,
}));

import { TaskComments } from "./task-comments";
import type { TaskComment } from "./tasks-api";

const config = { apiBaseUrl: "", authToken: "" };
const comment = (over: Partial<TaskComment> = {}): TaskComment => ({ id: "c1", body: "hi", authorName: "Ravi", createdAt: "2026-09-14", authorId: null, ...over });
const base = { taskId: "t1", comments: [] as TaskComment[], loading: false, actionConfig: config, onError: vi.fn(), onAdded: vi.fn() };

afterEach(() => apiRequest.mockReset());

describe("TaskComments", () => {
  it("shows loading / empty / populated states", () => {
    const { rerender } = render(<TaskComments {...base} loading />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    rerender(<TaskComments {...base} loading={false} />);
    expect(screen.getByText("No comments yet.")).toBeInTheDocument();
    rerender(<TaskComments {...base} comments={[comment({ body: "great work" }), comment({ id: "c2", body: "nice", authorName: null })]} />);
    expect(screen.getByText("great work")).toBeInTheDocument();
    expect(screen.getByText("Ravi")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument(); // null author
  });

  it("posts a comment (button + Enter) and clears the box", async () => {
    apiRequest.mockResolvedValue(comment({ id: "c2", body: "done" }));
    const onAdded = vi.fn();
    render(<TaskComments {...base} onAdded={onAdded} />);
    const input = screen.getByPlaceholderText("Add a comment…");
    fireEvent.change(input, { target: { value: "done" } });
    fireEvent.click(screen.getByText("Post"));
    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    expect(apiRequest).toHaveBeenCalledWith(config, "POST", "/tasks/t1/comments", { body: "done" });
    fireEvent.change(input, { target: { value: "again" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2));
  });

  it("does nothing for a blank comment and surfaces failures", async () => {
    render(<TaskComments {...base} />);
    fireEvent.keyDown(screen.getByPlaceholderText("Add a comment…"), { key: "Enter" }); // blank → no call
    expect(apiRequest).not.toHaveBeenCalled();

    apiRequest.mockRejectedValueOnce(new Error("x"));
    const onError = vi.fn();
    render(<TaskComments {...base} onError={onError} />);
    const input = screen.getAllByPlaceholderText("Add a comment…")[1];
    fireEvent.change(input, { target: { value: "boom" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(onError).toHaveBeenCalledWith("Could not add the comment."));
  });
});
