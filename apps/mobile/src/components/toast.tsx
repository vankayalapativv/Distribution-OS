import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Animated } from "react-native";
import {
  setToastSingleton,
  ToastContext,
  type Current,
  type ToastApi,
  type ToastOptions,
} from "./toast-core";
import { ToastView } from "./toast-view";

export { toast, type ToastVariant } from "./toast-core";

/**
 * App-wide transient feedback: a severity-coloured snackbar that slides down
 * from the top, auto-dismisses, and can be tapped to dismiss early. Use for
 * fire-and-forget outcomes (saved, action failed, you're offline) — for a
 * blocking form/submit error, prefer the inline {@link FeedbackBanner}.
 */
export function ToastProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [current, setCurrent] = useState<Current | null>(null);
  // useState (not useRef) so the lint rule against reading a ref during render
  // stays happy — the Animated.Value is still created once and stable.
  const [anim] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    // clearTimeout(null) is a safe runtime no-op, so no guard (or branch) is needed.
    clearTimeout(timer.current!);
    timer.current = null;
    Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setCurrent(null));
  }, [anim]);

  const show = useCallback(
    (o: ToastOptions) => {
      if (timer.current) clearTimeout(timer.current);
      setCurrent({ ...o, key: Date.now() });
      anim.setValue(0);
      Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      timer.current = setTimeout(hide, o.durationMs ?? 3500);
    },
    [anim, hide],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      error: (m, t) => show({ message: m, title: t, variant: "error" }),
      warning: (m, t) => show({ message: m, title: t, variant: "warning" }),
      success: (m, t) => show({ message: m, title: t, variant: "success" }),
      info: (m, t) => show({ message: m, title: t, variant: "info" }),
    }),
    [show],
  );

  useEffect(() => {
    setToastSingleton(api);
    return () => setToastSingleton(null);
  }, [api]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastView current={current} anim={anim} onPress={hide} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
