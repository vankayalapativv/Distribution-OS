import { createContext } from "react";
import { StatusBar } from "react-native";
import type { IconName } from "./icon";

// Top offset below the status bar. StatusBar.currentHeight (Android) avoids a
// dependency on a SafeAreaProvider ancestor — the provider is mounted deeper in
// the tree than the ToastProvider, so useSafeAreaInsets wouldn't resolve here.
export const TOP_INSET = (StatusBar.currentHeight ?? 24) + 8;

export type ToastVariant = "error" | "warning" | "success" | "info";

export interface ToastOptions {
  message: string;
  title?: string;
  variant?: ToastVariant;
  /** Auto-dismiss after this many ms (default 3500). */
  durationMs?: number;
}

export interface ToastApi {
  show: (opts: ToastOptions) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  success: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

export const VARIANT: Record<ToastVariant, { color: string; icon: IconName }> = {
  error: { color: "#dc2626", icon: "alert-circle" },
  warning: { color: "#d97706", icon: "warning-outline" },
  success: { color: "#16a34a", icon: "checkmark-circle" },
  info: { color: "#2563eb", icon: "information-circle" },
};

export const ToastContext = createContext<ToastApi | null>(null);

// Module-level handle so non-component code (mutation onError, lib helpers) can
// call `toast.error(...)` once the provider has mounted. No-ops before mount.
let singleton: ToastApi | null = null;
export function setToastSingleton(api: ToastApi | null): void {
  singleton = api;
}
export const toast: ToastApi = {
  show: (o) => singleton?.show(o),
  error: (m, t) => singleton?.show({ message: m, title: t, variant: "error" }),
  warning: (m, t) => singleton?.show({ message: m, title: t, variant: "warning" }),
  success: (m, t) => singleton?.show({ message: m, title: t, variant: "success" }),
  info: (m, t) => singleton?.show({ message: m, title: t, variant: "info" }),
};

export interface Current extends ToastOptions {
  key: number;
}
