export type SuperAdminSetupRole =
  | "SUPER_ADMIN"
  | "MANAGER"
  | "ACCOUNTANT"
  | "SALES_EXECUTIVE"
  | "LOGISTICS";

export interface SuperAdminSetupUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  /** Neon Auth user id (set when the account authenticates via Neon Auth). */
  appLoginId: string | null;
  roles: SuperAdminSetupRole[];
}

export interface SuperAdminSetupData {
  users: SuperAdminSetupUser[];
}

export interface SuperAdminActionConfig {
  apiBaseUrl: string;
  authToken: string;
}

export interface CreatedUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  role: SuperAdminSetupRole;
  appLoginId: string | null;
  generatedPassword: string;
}

export type CreateUserPayload = {
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
};

export interface CreatedCredentials {
  email: string;
  password: string;
  name: string;
}

export const defaultActionConfig: SuperAdminActionConfig = {
  apiBaseUrl: "http://localhost:8787/api/v1",
  authToken: "",
};

export const ROLE_LABELS: Record<SuperAdminSetupRole, string> = {
  SUPER_ADMIN: "Super Admin",
  MANAGER: "Manager",
  ACCOUNTANT: "Accountant",
  SALES_EXECUTIVE: "Sales Executive",
  LOGISTICS: "Logistics",
};

export function statusClass(status: string): string {
  return status === "active"
    ? "bg-secondary text-secondary-foreground"
    : "bg-muted text-muted-foreground";
}

export function contactLine(user: SuperAdminSetupUser): string {
  return [user.email, user.phone].filter(Boolean).join(" | ");
}
