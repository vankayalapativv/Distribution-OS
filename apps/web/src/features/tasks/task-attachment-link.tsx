"use client";

import { useState } from "react";
import { Paperclip } from "lucide-react";
import type { ActionConfig } from "@/lib/api-client";
import type { TaskAttachment } from "./tasks-api";

/** Fetches an attachment with the bearer token and opens it in a new tab. */
export function AttachmentLink({ attachment, config }: { readonly attachment: TaskAttachment; readonly config: ActionConfig }) {
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    try {
      const response = await fetch(`${config.apiBaseUrl}/task-files/${attachment.id}`, {
        headers: { Authorization: `Bearer ${config.authToken}` },
      });
      if (!response.ok) throw new Error("download failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      // leave silently; the row stays
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={() => void open()}
      disabled={busy}
      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline disabled:opacity-50"
    >
      <Paperclip size={13} />
      {attachment.fileName}
      {busy ? "…" : ""}
    </button>
  );
}
