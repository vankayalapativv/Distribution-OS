import { useCallback, useRef, useState } from "react";
import { MIN_LETTERS, NoOutcomeDialog, letterCount } from "./no-outcome-dialog";

/**
 * Mandatory reason prompt shown when an SE checks out of a visit that produced
 * no order and no collection. Free-text (no preset list), and it requires at
 * least 5 letters — the server demands a real reason before it will close such a
 * visit. Matches the Beyond "No order or collection" dialog.
 *
 * Promise-based like the confirm dialog: `promptReason()` resolves with the
 * trimmed reason, or null if the SE backs out (then the check-out is abandoned).
 */
export function useNoOutcomeReason() {
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState("");
  const resolveRef = useRef<((value: string | null) => void) | null>(null);

  const promptReason = useCallback(() => {
    setText("");
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
    <NoOutcomeDialog
      visible={visible}
      value={text}
      onChange={setText}
      onCancel={() => finish(null)}
      onSubmit={() => {
        const trimmed = text.trim();
        if (letterCount(trimmed) >= MIN_LETTERS) finish(trimmed);
      }}
    />
  );

  return { promptReason, sheet };
}
