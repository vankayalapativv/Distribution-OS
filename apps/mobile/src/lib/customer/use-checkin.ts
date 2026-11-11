import { useRef, useState } from "react";
import type { ConfirmOptions } from "../../components/dialog";
import { useNoOutcomeReason } from "../../components/customer/no-outcome-sheet";
import { useFollowupPicker } from "../../components/customer/followup-picker";
import type { VisitState } from "../../components/customer/check-in-button";
import { performCheckIn } from "./checkin";
import { performCheckOut } from "./checkout";

type Confirm = (opts: ConfirmOptions) => Promise<boolean>;

interface Args {
  id: string | undefined;
  token: string | null;
  userId: string | undefined;
  /** Visitor's role — a SUPER_ADMIN checks in without starting a day. */
  role: string | undefined;
  customerName: string;
  saved: { latitude: number | null; longitude: number | null };
  /** Server truth from the header, so the button survives an app reopen. */
  serverVisitedToday: boolean;
  serverCheckedOut: boolean;
  serverVisitId: string | null;
  confirm: Confirm;
  /** Refresh the header after a successful check-out (picks up server truth). */
  onChanged?: () => void;
}

/**
 * Drives the 3-state visit button (check in → check out → visited today) with
 * optimistic session overrides on top of the server's header truth, plus a
 * synchronous re-entry guard so rapid taps can't fire concurrent requests.
 */
export function useCheckIn({
  id,
  token,
  userId,
  role,
  customerName,
  saved,
  serverVisitedToday,
  serverCheckedOut,
  serverVisitId,
  confirm,
  onChanged,
}: Args) {
  const { promptReason, sheet: reasonSheet } = useNoOutcomeReason();
  const { pickDateTime, sheet: followupSheet } = useFollowupPicker();
  const [busy, setBusy] = useState(false);
  // `busy` is React state (updates next render), so 3 rapid taps can all pass
  // the check before the button disables. A ref flips immediately.
  const busyRef = useRef(false);
  // Optimistic session overrides layered over the server header.
  const [sessionVisitId, setSessionVisitId] = useState<string | null>(null);
  const [checkedInThisSession, setCheckedInThisSession] = useState(false);
  const [checkedOutThisSession, setCheckedOutThisSession] = useState(false);

  const done = serverCheckedOut || checkedOutThisSession;
  const open = !done && (serverVisitedToday || checkedInThisSession);
  let state: VisitState = "none";
  if (done) state = "done";
  else if (open) state = "open";
  const visitId = sessionVisitId ?? serverVisitId;

  async function onCheckIn() {
    const newVisitId = await performCheckIn({ id: id!, token, userId, role, customerName, saved, confirm });
    if (newVisitId) {
      setSessionVisitId(newVisitId);
      setCheckedInThisSession(true);
    }
  }

  async function onCheckOut() {
    if (!visitId) {
      void confirm({
        title: "Check-out unavailable",
        message: "Pull to refresh and try again.",
        confirmLabel: "OK",
      });
      return;
    }
    const closed = await performCheckOut({ visitId, customerId: id!, token, customerName, saved, confirm, promptReason, pickDateTime });
    if (closed) {
      setCheckedOutThisSession(true);
      onChanged?.();
    }
  }

  async function onPress() {
    if (!id || busyRef.current || done) return;
    busyRef.current = true;
    setBusy(true);
    try {
      if (open) await onCheckOut();
      else await onCheckIn();
    } catch {
      void confirm({
        title: open ? "Check-out failed" : "Check-in failed",
        message: `Couldn't record the ${open ? "check-out" : "check-in"} — check your connection and try again.`,
        confirmLabel: "OK",
      });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return { state, busy, onPress, reasonSheet, followupSheet };
}
