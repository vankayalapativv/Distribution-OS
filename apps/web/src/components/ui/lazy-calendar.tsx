"use client";

import dynamic from "next/dynamic";

/**
 * Code-split wrapper around the shadcn `Calendar` (react-day-picker). Every date
 * picker in the app lives behind a popover, so the (heavy) picker library only
 * downloads the first time a user opens one — keeping it out of the initial bundle
 * of every page that has a date filter. Drop-in replacement for `Calendar`.
 */
export const LazyCalendar = dynamic(
  () => import("./calendar").then((m) => m.Calendar),
  {
    ssr: false,
    loading: () => (
      <div className="h-[290px] w-full min-w-[15rem] animate-pulse rounded-md bg-muted" />
    ),
  },
);
