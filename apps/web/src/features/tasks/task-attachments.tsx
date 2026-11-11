"use client";

import { useRef, useState } from "react";
import { Paperclip } from "lucide-react";
import { errorMessage, type ActionConfig } from "@/lib/api-client";
import type { TaskAttachment } from "./tasks-api";
import { AttachmentLink } from "./task-attachment-link";

interface TaskAttachmentsProps {
  readonly taskId: string;
  readonly attachments: TaskAttachment[];
  readonly loading: boolean;
  readonly actionConfig: ActionConfig;
  readonly onError: (message: string | null) => void;
  readonly onAdded: (attachment: TaskAttachment) => void;
}

export function TaskAttachments({
  taskId,
  attachments,
  loading,
  actionConfig,
  onError,
  onAdded,
}: TaskAttachmentsProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function uploadAttachment(file: File) {
    setUploading(true);
    onError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(`${actionConfig.apiBaseUrl}/tasks/${taskId}/attachments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${actionConfig.authToken}` },
        body: form,
      });
      if (!response.ok) throw new Error(`Upload failed (${response.status})`);
      const payload = (await response.json()) as { data: TaskAttachment };
      onAdded(payload.data);
    } catch (e) {
      onError(errorMessage(e, "Could not upload the file."));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Attachments
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
        >
          <Paperclip size={12} /> {uploading ? "Uploading…" : "Attach file"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadAttachment(file);
            e.target.value = "";
          }}
        />
      </div>
      {(() => { if (loading) return (
        <p className="mt-2 text-xs text-muted-foreground">Loading…</p>
      ); if (attachments.length === 0) return (
        <p className="mt-2 text-xs text-muted-foreground">No attachments.</p>
      ); return (
        <ul className="mt-2 flex flex-col gap-1.5">
          {attachments.map((a) => (
            <li key={a.id}>
              <AttachmentLink attachment={a} config={actionConfig} />
            </li>
          ))}
        </ul>
      ); })()}
    </div>
  );
}
