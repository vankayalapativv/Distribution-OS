import { ROLE_LABELS } from "./super-admin-types";

/** Up to two uppercase initials from a name, for the avatar chip. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** A subtle per-role badge; SUPER_ADMIN gets the primary tint. */
export function RoleBadge({ role }: { readonly role: string }) {
  const isAdmin = role === "SUPER_ADMIN";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        isAdmin ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
      }`}
    >
      {ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role}
    </span>
  );
}
