import type { ConfirmOptions } from "../../components/dialog";
import type { getCheckInFix } from "../gps";

export type Confirm = (opts: ConfirmOptions) => Promise<boolean>;

export interface CheckInOpts {
  id: string;
  token: string | null;
  userId: string | undefined;
  customerName: string;
  saved: { latitude: number | null; longitude: number | null };
  /** Visitor's role — a SUPER_ADMIN checks in WITHOUT starting a day. */
  role: string | undefined;
  confirm: Confirm;
}

/** A GPS fix that passed the null + freshness checks. */
export type CheckInFix = NonNullable<Awaited<ReturnType<typeof getCheckInFix>>>;
