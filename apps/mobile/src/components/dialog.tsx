import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ConfirmOptions, DialogState, PromptOptions } from "./dialog-types";
import { DialogCard } from "./dialog-view";

export type { ConfirmOptions, PromptOptions } from "./dialog-types";

interface DialogApi {
  /** Show a styled confirm dialog; resolves true if the primary action is tapped. */
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  /** Single-button informational dialog. */
  alert: (opts: Omit<ConfirmOptions, "cancelLabel" | "destructive">) => Promise<void>;
  /** Text-entry dialog; resolves the entered (trimmed) string, or null if cancelled. */
  prompt: (opts: PromptOptions) => Promise<string | null>;
}

/** What a pending dialog resolves to: boolean for confirm/alert, string|null for prompt. */
type DialogResolution = boolean | string | null;

const DialogContext = createContext<DialogApi | null>(null);

/**
 * In-app styled dialog to replace the OS `Alert.alert` (which can't be themed).
 * Matches the app's card/typography and adapts to light/dark via tokens.
 */
export function DialogProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [state, setState] = useState<DialogState>({ visible: false, title: "" });
  const [value, setValue] = useState("");
  // Resolves the pending dialog: boolean for confirm/alert, string|null for prompt.
  const resolveRef = useRef<((value: DialogResolution) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve as (v: DialogResolution) => void;
      setState({ ...opts, input: false, visible: true });
    });
  }, []);

  const alert = useCallback(
    (opts: Omit<ConfirmOptions, "cancelLabel" | "destructive">) =>
      confirm({ ...opts, cancelLabel: null }).then(() => undefined),
    [confirm],
  );

  const prompt = useCallback((opts: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      resolveRef.current = resolve as (v: DialogResolution) => void;
      setValue(opts.defaultValue ?? "");
      setState({ ...opts, input: true, visible: true });
    });
  }, []);

  // Primary action: resolve the trimmed text in prompt mode, else true.
  const submit = useCallback(() => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setState((s) => ({ ...s, visible: false }));
    resolve?.(state.input ? value.trim() : true);
  }, [state.input, value]);

  const cancel = useCallback(() => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setState((s) => ({ ...s, visible: false }));
    resolve?.(state.input ? null : false);
  }, [state.input]);

  // Stable context value so consumers don't re-render on every provider render.
  const api = useMemo<DialogApi>(() => ({ confirm, alert, prompt }), [confirm, alert, prompt]);

  return (
    <DialogContext.Provider value={api}>
      {children}
      <DialogCard
        state={state}
        value={value}
        onChangeValue={setValue}
        onSubmit={submit}
        onCancel={cancel}
      />
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within DialogProvider");
  return ctx;
}
