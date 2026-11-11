/**
 * The shimmer engine: one shared native-driver transform loop that every
 * skeleton block reads from, so the whole layout sweeps in sync and we never
 * run more than a single animation no matter how many blocks are on screen.
 */
import { createContext, useContext, useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";

export const SWEEP_MS = 1100;

/** One shared drive value so every block shimmers in sync (and we run a
 *  single animation loop no matter how many blocks are on screen). */
export const SweepContext = createContext<Animated.Value | null>(null);

export function useSweep(): Animated.Value {
  const shared = useContext(SweepContext);
  const local = useRef<Animated.Value | null>(null);
  if (!shared && !local.current) local.current = new Animated.Value(0);
  const value = shared ?? local.current!;

  useEffect(() => {
    if (shared) return; // provider owns the loop
    const loop = Animated.loop(
      Animated.timing(value, {
        toValue: 1,
        duration: SWEEP_MS,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [shared, value]);

  return value;
}

/** Wrap a whole skeleton layout so all blocks share one animation loop. */
export function SkeletonTheme({ children }: { readonly children: React.ReactNode }) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(value, {
        toValue: 1,
        duration: SWEEP_MS,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [value]);
  return <SweepContext.Provider value={value}>{children}</SweepContext.Provider>;
}
