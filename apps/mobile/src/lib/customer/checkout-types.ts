import type { ConfirmOptions } from "../../components/dialog";

export type Confirm = (opts: ConfirmOptions) => Promise<boolean>;
export type PromptReason = () => Promise<string | null>;
export type PickDateTime = (opts?: {
  title?: string;
  message?: string;
  initial?: Date;
}) => Promise<string | null>;

export interface CheckOutOpts {
  /** Server visit id (online/header visit) OR the check-in clientUuid (offline). */
  visitId: string;
  /** Customer id — needed to seed a header-only visit row when queueing offline. */
  customerId: string;
  token: string | null;
  customerName: string;
  saved: { latitude: number | null; longitude: number | null };
  confirm: Confirm;
  promptReason: PromptReason;
  /** Optional follow-up reminder picker, offered after a no-outcome reason. */
  pickDateTime: PickDateTime;
}

export type Fix = { latitude: number; longitude: number; accuracy: number | null };

export interface Captured {
  reason: string;
  followUpAt: string | null;
}
