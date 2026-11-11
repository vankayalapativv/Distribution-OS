/**
 * The cookie name for the desktop sidebar collapsed state. Lives in its own
 * server-safe module (NOT "use client") so the root layout — a Server Component —
 * imports the real string literal. Importing it from the "use client"
 * `sidebar-state.tsx` would hand the server a client-reference proxy instead of
 * the string, breaking `cookies().get(...)`.
 */
export const SIDEBAR_COLLAPSED_COOKIE = "sidebar_collapsed";
