import { API_BASE_URL } from "./api";
import { useAuth } from "./auth";
import { getIsOnline, subscribeOnline } from "./connectivity";
import { getLocalDb } from "./db";
import { flushErrorBuffer, readErrorBuffer } from "./error-buffer";
import type { IngestPayload } from "./report-error";

/** POST one report to the in-house monitor (/errors/ingest). Returns false on any failure. */
export async function post(token: string, payload: IngestPayload): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/errors/ingest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

let flushing = false;
/** Send any buffered reports, keeping the ones that still fail. Safe to call often. */
export async function flushPendingErrors(): Promise<void> {
  if (flushing || !getIsOnline()) return;
  const token = useAuth.getState().token;
  if (!token) return;
  if (readErrorBuffer(getLocalDb()).length === 0) return;
  flushing = true;
  try {
    await flushErrorBuffer<IngestPayload>(getLocalDb(), (item) => post(token, item));
  } finally {
    flushing = false;
  }
}

// Auto-flush the moment connectivity returns.
subscribeOnline((online) => {
  if (online) void flushPendingErrors();
});
