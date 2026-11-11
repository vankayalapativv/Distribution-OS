import { useDialog } from "../components/dialog";
import { useAuth } from "./auth";

/** Account state + handlers for the Super Admin settings screen:
 *  role label and the logout confirm flow. */
export function useAdminSettings() {
  const { user, logout } = useAuth();
  const dialog = useDialog();

  async function onLogout() {
    const ok = await dialog.confirm({
      title: "Log out?",
      message: "You'll need to sign in again to access the dashboard.",
      confirmLabel: "Log out",
      cancelLabel: "Cancel",
      destructive: true,
    });
    if (ok) void logout();
  }

  const roleLabel = (user?.role ?? "")
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return { user, roleLabel, onLogout };
}
