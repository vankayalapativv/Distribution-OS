import { useCallback, useRef, useState } from "react";
import { DateTimePickerCard } from "../datetime-picker";

interface PickOpts {
  title?: string;
  message?: string;
  initial?: Date;
}

/**
 * Promise-based follow-up reminder picker, mirroring `useNoOutcomeReason`.
 * `pickDateTime()` resolves with the chosen ISO string, or null when the SE taps
 * "Not now" (skips the reminder — the follow-up is still recorded, just without a
 * push time). The card remounts on each open (changing key) so its state re-seeds
 * from `initial`. Opens on now + 1 hour by default.
 */
export function useFollowupPicker() {
  const [visible, setVisible] = useState(false);
  const [opts, setOpts] = useState<PickOpts>({});
  const [initial, setInitial] = useState<Date>(() => new Date());
  const [openKey, setOpenKey] = useState(0);
  const resolveRef = useRef<((value: string | null) => void) | null>(null);

  const pickDateTime = useCallback((o?: PickOpts) => {
    setOpts(o ?? {});
    // Default the picker to now + 1 hour; computed in this handler (not during
    // render) so the card seeds from a stable value on each open.
    setInitial(o?.initial ?? new Date(Date.now() + 60 * 60 * 1000));
    setOpenKey((k) => k + 1);
    setVisible(true);
    return new Promise<string | null>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const finish = useCallback((value: string | null) => {
    setVisible(false);
    resolveRef.current?.(value);
    resolveRef.current = null;
  }, []);

  const sheet = (
    <DateTimePickerCard
      key={openKey}
      visible={visible}
      initial={initial}
      title={opts.title ?? "Set a follow-up reminder?"}
      message={opts.message ?? "We'll remind you — with this customer's name — at the time you pick."}
      onCancel={() => finish(null)}
      onConfirm={(iso) => finish(iso)}
    />
  );

  return { pickDateTime, sheet };
}
