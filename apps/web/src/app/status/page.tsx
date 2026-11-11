import { StatusView } from "../../features/status/status-view";

/**
 * Public system-status page (#7) — no auth, so it works during an outage. It
 * polls the same-origin /api/health proxy and shows API + Database health.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "System Status — Sri Aparajitha Enterprise Distribution Management System",
};

export default function StatusPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <StatusView />
    </main>
  );
}
