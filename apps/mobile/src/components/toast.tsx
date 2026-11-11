import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StatusBar, Text, View } from "react-native";
import { Icon, type IconName } from "./icon";

// Top offset below the status bar. StatusBar.currentHeight (Android) avoids a
// dependency on a SafeAreaProvider ancestor — the provider is mounted deeper in
// the tree than the ToastProvider, so useSafeAreaInsets wouldn't resolve here.
const TOP_INSET = (StatusBar.currentHeight ?? 24) + 8;

export type ToastVariant = "error" | "warning" | "success" | "info";

interface ToastOptions {
  message: string;
  title?: string;
  variant?: ToastVariant;
  /** Auto-dismiss after this many ms (default 3500). */
  durationMs?: number;
}

interface ToastApi {
  show: (opts: ToastOptions) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  success: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

const VARIANT: Record<ToastVariant, { color: string; icon: IconName }> = {
  error: { color: "#dc2626", icon: "alert-circle" },
  warning: { color: "#d97706", icon: "warning-outline" },
  success: { color: "#16a34a", icon: "checkmark-circle" },
  info: { color: "#2563eb", icon: "information-circle" },
};

const ToastContext = createContext<ToastApi | null>(null);

// Module-level handle so non-component code (mutation onError, lib helpers) can
// call `toast.error(...)` once the provider has mounted. No-ops before mount.
let singleton: ToastApi | null = null;
export const toast: ToastApi = {
  show: (o) => singleton?.show(o),
  error: (m, t) => singleton?.show({ message: m, title: t, variant: "error" }),
  warning: (m, t) => singleton?.show({ message: m, title: t, variant: "warning" }),
  success: (m, t) => singleton?.show({ message: m, title: t, variant: "success" }),
  info: (m, t) => singleton?.show({ message: m, title: t, variant: "info" }),
};

interface Current extends ToastOptions {
  key: number;
}

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
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
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
    singleton = api;
    return () => {
      if (singleton === api) singleton = null;
    };
  }, [api]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const v = VARIANT[current?.variant ?? "info"];

  return (
    <ToastContext.Provider value={api}>
      {children}
      {current ? (
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            top: TOP_INSET,
            left: 12,
            right: 12,
            opacity: anim,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
          }}
        >
          <Pressable
            onPress={hide}
            accessibilityRole="alert"
            className="flex-row items-start gap-2.5 rounded-xl border bg-white px-4 py-3"
            style={{
              borderColor: v.color,
              shadowColor: "#0f172a",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.12,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <Icon name={v.icon} size={18} color={v.color} />
            <View className="flex-1 gap-0.5">
              {current.title ? (
                <Text className="text-sm font-semibold leading-5" style={{ color: v.color }}>
                  {current.title}
                </Text>
              ) : null}
              <Text className="text-sm font-medium leading-5 text-foreground">{current.message}</Text>
            </View>
          </Pressable>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
