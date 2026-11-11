import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The shell pulls in the sidebar (react-query); render just its children so the
// test focuses on the Users page content.
vi.mock("@/features/shell/dashboard-shell", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DashboardShell: ({ children }: any) => <div>{children}</div>,
}));

import { SuperAdminSetup, type SuperAdminSetupData } from "./super-admin-setup";

const setupData: SuperAdminSetupData = {
  users: [
    {
      id: "user-manager",
      name: "Demo Manager",
      email: "manager@example.test",
      phone: "+919000000101",
      status: "active",
      appLoginId: null,
      roles: ["MANAGER"],
    },
    {
      id: "user-executive",
      name: "Anika Sharma",
      email: "anika@example.test",
      phone: "+919000000102",
      status: "active",
      appLoginId: null,
      roles: ["SALES_EXECUTIVE"],
    },
  ],
};

const actionConfig = {
  apiBaseUrl: "http://api.example.test/api/v1",
  authToken: "real-jwt",
};

describe("SuperAdminSetup (Users)", () => {
  it("renders a Users-only page with the user list", () => {
    render(<SuperAdminSetup setupData={setupData} actionConfig={actionConfig} />);

    expect(screen.getByRole("heading", { name: "Users" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add User" })).toBeInTheDocument();
    expect(screen.getByText("Demo Manager")).toBeInTheDocument();
    expect(screen.getByText("Anika Sharma")).toBeInTheDocument();
  });

  it("no longer offers Teams or Territories", () => {
    render(<SuperAdminSetup setupData={setupData} actionConfig={actionConfig} />);

    expect(screen.queryByRole("button", { name: "Add Team" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Territory" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Teams" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Territories" })).not.toBeInTheDocument();
  });

  it("opens the Add User dialog", () => {
    render(<SuperAdminSetup setupData={setupData} actionConfig={actionConfig} />);

    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add User" }));
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
  });
});
