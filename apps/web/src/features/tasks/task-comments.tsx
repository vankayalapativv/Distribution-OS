"use client";

import { useState } from "react";
import { apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import type { TaskComment } from "./tasks-api";
import { formatDate } from "./tasks-shared";

interface TaskCommentsProps {
  readonly taskId: string;
  readonly comments: TaskComment[];
  readonly loading: boolean;
  readonly actionConfig: ActionConfig;
  readonly onError: (message: string | null) => void;
  readonly onAdded: (comment: TaskComment) => void;
}

export function TaskComments({
  taskId,
  comments,
  loading,
  actionConfig,
  onError,
  onAdded,
}: TaskCommentsProps) {
  const [newComment, setNewComment] = useState("");
  const [savingComment, setSavingComment] = useState(false);

  async function addComment() {
    if (!newComment.trim()) return;
    setSavingComment(true);
    try {
      const comment = await apiRequest<TaskComment>(
        actionConfig,
        "POST",
        `/tasks/${taskId}/comments`,
        { body: newComment.trim() },
      );
      onAdded(comment);
      setNewComment("");
    } catch (e) {
      onError(errorMessage(e, "Could not add the comment."));
    } finally {
      setSavingComment(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Comments
      </p>
      <div className="mt-2 flex flex-col gap-3">
        {(() => { if (loading) return (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ); if (comments.length === 0) return (
          <p className="text-xs text-muted-foreground">No comments yet.</p>
        ); return (
          comments.map((comment) => (
            <div key={comment.id} className="rounded-md bg-slate-50 px-3 py-2">
              <p className="text-xs font-medium text-foreground">
                {comment.authorName ?? "—"}
                <span className="ml-2 font-normal text-muted-foreground">
                  {formatDate(comment.createdAt)}
                </span>
              </p>
              <p className="mt-1 text-sm text-foreground">{comment.body}</p>
            </div>
          ))
        ); })()}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void addComment();
          }}
          placeholder="Add a comment…"
          className="flex-1 rounded-md border border-border px-3 py-2 text-sm"
        />
        <button
          onClick={() => void addComment()}
          disabled={!newComment.trim() || savingComment}
          className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          Post
        </button>
      </div>
    </div>
  );
}
