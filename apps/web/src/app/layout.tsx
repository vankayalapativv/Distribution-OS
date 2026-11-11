import type { Metadata } from "next";
import { cookies } from "next/headers";
import { BRAND } from "@distribution-os/shared";
import "./globals.css";
import { cn } from "@/lib/utils";
import { WebErrorReporter } from "@/components/web-error-reporter";
import { getSessionRole } from "@/features/auth/auth-role";
import { PermissionsProvider } from "@/features/shell/permissions-context";
import { SidebarCollapsedProvider } from "@/features/shell/sidebar-state";
import { SIDEBAR_COLLAPSED_COOKIE } from "@/features/shell/sidebar-cookie";

export const metadata: Metadata = {
  title: BRAND.name,
  description: "Distribution management dashboard",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Resolve effective permissions once, here at the root, so EVERY page (the
  // role-neutral home at app/page.tsx included — it lives outside the
  // (dashboard) group) supplies them to the sidebar via context. This makes the
  // nav correct on first paint with no client fetch / no flash. getSessionRole
  // returns null (→ empty map) when not signed in; auth guards live in pages.
  const auth = await getSessionRole();
  const cookieStore = await cookies();
  const sidebarCollapsed = cookieStore.get(SIDEBAR_COLLAPSED_COOKIE)?.value === "1";
  return (
    <html lang="en" className={cn("h-full antialiased", "font-sans")}>
      <body className="min-h-full flex flex-col">
        <WebErrorReporter />
        <PermissionsProvider value={auth?.permissions ?? {}}>
          <SidebarCollapsedProvider initial={sidebarCollapsed}>{children}</SidebarCollapsedProvider>
        </PermissionsProvider>
      </body>
    </html>
  );
}
