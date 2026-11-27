/**
 * jsdom setup for the `components` test project. Registers `@testing-library`
 * matchers, auto-unmounts React trees between tests, and stubs the native-only
 * modules that can't run under react-native-web + jsdom. Mocks here are global
 * (vitest hoists `vi.mock` in a setup file across every test in the project);
 * a test that needs different behaviour overrides with its own `vi.mock`.
 */
// `vi.mock` factories are hoisted above imports, so they can't close over
// module-scope imports — they `require("react-native-web")` lazily instead.
/* eslint-disable @typescript-eslint/no-require-imports */
import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import React from "react";

afterEach(() => cleanup());

// Many RN / expo-modules-core files read the `__DEV__` global at load time.
(globalThis as { __DEV__?: boolean }).__DEV__ = true;

// --- expo-router: a stubbed router + navigation primitives -------------------
const routerStub = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  dismiss: vi.fn(),
  dismissAll: vi.fn(),
  navigate: vi.fn(),
  setParams: vi.fn(),
  canGoBack: vi.fn(() => true),
};
vi.mock("expo-router", () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  const Link = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  const Stack = Object.assign(passthrough, { Screen: () => null });
  const Tabs = Object.assign(passthrough, { Screen: () => null });
  return {
    router: routerStub,
    useRouter: () => routerStub,
    useLocalSearchParams: () => ({}),
    useGlobalSearchParams: () => ({}),
    useSegments: () => [],
    usePathname: () => "/",
    // Run the focus callback on mount (callers wrap it in useCallback, so the dep
    // is stable), mirroring a screen gaining focus — and honour its cleanup.
    useFocusEffect: (cb: () => void | (() => void)) => {
      React.useEffect(() => {
        const cleanup = cb();
        return typeof cleanup === "function" ? cleanup : undefined;
      }, [cb]);
    },
    useNavigation: () => ({ setOptions: vi.fn(), addListener: vi.fn(() => vi.fn()) }),
    Link,
    Stack,
    Tabs,
    Redirect: () => null,
    SplashScreen: { hideAsync: vi.fn(), preventAutoHideAsync: vi.fn() },
  };
});

// --- safe-area: zero insets, SafeAreaView passes through ---------------------
vi.mock("react-native-safe-area-context", () => {
  const View = require("react-native-web").View;
  const insets = { top: 0, bottom: 0, left: 0, right: 0 };
  return {
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
    SafeAreaView: View,
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    SafeAreaInsetsContext: React.createContext(insets),
  };
});

// --- keyboard-controller: inert views/hooks ----------------------------------
vi.mock("react-native-keyboard-controller", () => {
  const ScrollView = require("react-native-web").ScrollView;
  return {
    KeyboardAwareScrollView: ScrollView,
    KeyboardProvider: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    KeyboardController: { dismiss: vi.fn() },
    useKeyboardHandler: () => {},
    useReanimatedKeyboardAnimation: () => ({ height: { value: 0 }, progress: { value: 0 } }),
  };
});

// --- expo-image: render as a plain RN Image ----------------------------------
vi.mock("expo-image", () => {
  const RNWeb = require("react-native-web");
  return { Image: RNWeb.Image };
});

// --- react-native-reanimated: shared values are plain mutable refs, timing is
//     identity, animated styles resolve once. Enough for render + logic tests.
vi.mock("react-native-reanimated", () => {
  const RNWeb = require("react-native-web");
  const React = require("react");
  const Animated = {
    View: (props: Record<string, unknown>) => React.createElement(RNWeb.View, props),
    Image: RNWeb.Image,
    createAnimatedComponent: (C: unknown) => C,
  };
  return {
    default: Animated,
    useSharedValue: (init: unknown) => ({ value: init }),
    withTiming: (v: unknown) => v,
    withSpring: (v: unknown) => v,
    useAnimatedStyle: (fn: () => unknown) => fn(),
    runOnJS: (fn: unknown) => fn,
  };
});

// --- react-native-gesture-handler: gesture builders capture their callbacks on
//     `_cbs` so tests can invoke them; detectors/roots pass through.
vi.mock("react-native-gesture-handler", () => {
  const RNWeb = require("react-native-web");
  const React = require("react");
  const builder = () => {
    const g: Record<string, unknown> = { _cbs: {} };
    const chain = (key: string) => (cb: unknown) => {
      (g._cbs as Record<string, unknown>)[key] = cb;
      return g;
    };
    g.onUpdate = chain("update");
    g.onBegin = chain("begin");
    g.onEnd = chain("end");
    g.onStart = chain("start");
    g.numberOfTaps = () => g;
    g.minDistance = () => g;
    return g;
  };
  return {
    Gesture: {
      Pinch: builder,
      Pan: builder,
      Tap: builder,
      Simultaneous: (...gs: unknown[]) => ({ _children: gs }),
      Race: (...gs: unknown[]) => ({ _children: gs }),
    },
    GestureDetector: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    GestureHandlerRootView: (props: Record<string, unknown>) =>
      React.createElement(RNWeb.View, props),
  };
});

// --- connectivity: online by default (expo-network can't load under jsdom). A
//     test that needs the offline path overrides this with its own vi.mock.
vi.mock("../lib/connectivity", () => ({
  useIsOnline: () => true,
  getIsOnline: () => true,
  subscribeOnline: () => () => {},
}));

// --- @expo/vector-icons: a plain glyph stub (the real font set can't transform
//     under rolldown/jsdom, and we only ever assert text/structure, not glyphs).
vi.mock("@expo/vector-icons/Ionicons", () => {
  const RN = require("react-native-web");
  const React = require("react");
  const Ionicons = ({ name }: { name?: string }) =>
    React.createElement(RN.Text, { accessibilityRole: "image", "aria-label": name }, null);
  return { default: Ionicons, Ionicons };
});
