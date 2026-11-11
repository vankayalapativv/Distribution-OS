import type { AuditLog } from "./audit-logs-api";

const ROLE_TONE: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-50 text-purple-700 ring-1 ring-purple-600/20",
  MANAGER: "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20",
  ACCOUNTANT: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20",
  SALES_EXECUTIVE: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20",
  LOGISTICS: "bg-slate-100 text-slate-600",
};

/** SUPER_ADMIN → "Super Admin". */
export function roleLabel(role: string | null): string {
  if (!role) return "";
  return role
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

/** The "Who" cell: actor name with a role-toned pill beneath it. */
export function ActorCell({ log }: { readonly log: AuditLog }) {
  return (
    <span className="flex flex-col items-start">
      <span className="font-medium">{log.actorName}</span>
      {log.actorRole ? (
        <span
          className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            ROLE_TONE[log.actorRole] ?? "bg-muted text-muted-foreground"
          }`}
        >
          {roleLabel(log.actorRole)}
        </span>
      ) : null}
    </span>
  );
}
