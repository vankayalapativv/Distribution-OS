/**
 * Turn any thrown value (ApiRequestError, network/timeout, or an unknown crash)
 * into a short, friendly, ACTIONABLE title + message for the UI — so screens
 * stop showing raw server text or a bare "Couldn't load". Kept UI-free (returns
 * strings) so it works in components, toasts, and dialogs alike.
 */
import { ApiRequestError } from "./api";

/** How serious a failure is, so the UI can colour it: a hard **error** (red,
 *  something broke / needs action) vs a softer **warning** (amber, transient or
 *  the user's own situation — offline, timed out, nothing to show). */
export type ErrorSeverity = "error" | "warning";

export interface FriendlyError {
  title: string;
  message: string;
  severity: ErrorSeverity;
}

/** Friendly title/message/severity for a server-side (ApiRequestError) failure,
 *  or null when the status doesn't map to one (falls through to generic handling). */
function friendlyApiError(error: ApiRequestError): FriendlyError | null {
  if (error.code === "ACCOUNT_INACTIVE") {
    return {
      title: "Account deactivated",
      message: error.message || "Your account has been deactivated. Please contact your administrator.",
      severity: "error",
    };
  }
  if (error.status >= 500) {
    return { title: "Server hiccup", message: "Something went wrong on our end. Please try again in a moment.", severity: "error" };
  }
  if (error.status === 401) {
    return { title: "Session expired", message: "Please sign in again to continue.", severity: "error" };
  }
  if (error.status === 402) {
    // Billing block — not the user's fault; tell them who can fix it.
    return { title: "Payment required", message: error.message || "This account's monthly subscription is due. Ask your administrator to clear it to continue.", severity: "warning" };
  }
  if (error.status === 403) {
    return { title: "Not allowed", message: error.message || "You don't have access to this.", severity: "error" };
  }
  if (error.status === 404) {
    return { title: "Not found", message: "This may have been removed or isn't available.", severity: "warning" };
  }
  if (error.status === 408 || error.status === 429) {
    return { title: "Please retry", message: "The request timed out or the server was busy. Try again.", severity: "warning" };
  }
  if (error.status >= 400) {
    // A real 4xx usually carries a meaningful server message worth showing.
    return { title: "Couldn't complete", message: error.message || "Please check your input and try again.", severity: "error" };
  }
  return null;
}

export function humanizeError(error: unknown, opts?: { online?: boolean }): FriendlyError {
  const online = opts?.online ?? true;

  // Offline dominates: the specific error rarely matters if there's no signal.
  if (!online) {
    return {
      title: "You're offline",
      message: "Reconnect to load the latest. Anything you've saved is safe and will sync.",
      severity: "warning",
    };
  }

  if (error instanceof ApiRequestError) {
    const friendly = friendlyApiError(error);
    if (friendly) return friendly;
  }

  const msg = error instanceof Error ? error.message : "";
  // Includes DNS-resolution failures ("UnknownHostException: Unable to resolve
  // host … No address associated with hostname") seen on weak 4G, so the login
  // screen shows a friendly prompt instead of a raw Java stack trace.
  if (
    /network|timeout|timed out|abort|failed to fetch|connection|unknownhost|unable to resolve|resolve host|no address|fetch failed/i.test(
      msg,
    )
  ) {
    return { title: "Connection problem", message: "Check your signal and try again.", severity: "warning" };
  }
  return { title: "Something went wrong", message: "Please try again in a moment.", severity: "error" };
}
