import { beforeEach, describe, expect, test, vi } from "vitest";
import { authHeaders, authTestEnv, installAuthFetchMock } from "../test/auth";

const setupRows = {
  users: [
    {
      id: "00000000-0000-4000-8000-000000000101",
      name: "Demo Manager",
      email: "manager@example.test",
      phone: "+919000000101",
      status: "active",
      roles: "MANAGER",
    },
    {
      id: "00000000-0000-4000-8000-000000000102",
      name: "Anika Sharma",
      email: "anika@example.test",
      phone: "+919000000102",
      status: "active",
      roles: "SALES_EXECUTIVE",
    },
  ],
  createdUser: [
    {
      id: "00000000-0000-4000-8000-000000000401",
      name: "New Executive",
      email: "new.executive@example.test",
      phone: "+919000000401",
      status: "active",
    },
  ],
  role: [{ id: "00000000-0000-4000-8000-000000000501" }],
};

vi.mock("@neondatabase/serverless", () => {
  const handler = async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join(" ");

    if (query.includes("auth_app_profile")) {
      const roleBySubject = {
        "neon-manager": "MANAGER",
        "neon-super-admin": "SUPER_ADMIN",
      } as const;

      return [
        {
          role: roleBySubject[values[0] as keyof typeof roleBySubject],
          userId: "00000000-0000-4000-8000-000000000001",
        },
      ];
    }

    if (query.includes("super_admin_setup_users")) {
      return setupRows.users;
    }

    if (query.includes("user_device_from_push")) {
      return [{ manufacturer: "Samsung", model: "SM-G991B", androidVersion: null, lastSeenAt: "2026-10-01" }];
    }

    if (query.includes("super_admin_role_lookup")) {
      return setupRows.role;
    }

    if (query.includes("super_admin_create_user")) {
      return setupRows.createdUser;
    }

    if (query.includes("super_admin_assign_role")) {
      return [];
    }

    if (query.includes("super_admin_get_user")) {
      // Unknown ids return nothing so the service 404s.
      return values.includes(TARGET_USER_ID) || values.includes(OTHER_ADMIN_ID)
        ? [{ id: values[0], name: "Ravi", email: "ravi@x.com", phone: "+919000000001", status: "active" }]
        : [];
    }

    if (query.includes("super_admin_user_roles")) {
      return values.includes(OTHER_ADMIN_ID)
        ? [{ code: "SUPER_ADMIN" }]
        : [{ code: "SALES_EXECUTIVE" }];
    }

    if (query.includes("super_admin_user_unique_check")) {
      return values.includes("taken@x.com") ? [{ id: "someone-else" }] : [];
    }

    if (query.includes("super_admin_update_user")) {
      return [
        {
          id: TARGET_USER_ID,
          name: values[0],
          email: values[1],
          phone: values[2],
          status: values[3],
        },
      ];
    }

    return [];
  };

  // Neon's HTTP driver runs an array of queries atomically. The fake `sql` tag
  // is eager, so each entry is already a Promise<rows>; resolve them so callers
  // (e.g. the user-create CTE) read real rows.
  handler.transaction = async (queries: unknown[]) => {
    return Promise.all(queries as Array<Promise<unknown>>);
  };

  return { neon: () => handler };
});

const TARGET_USER_ID = "00000000-0000-4000-8000-000000000501";
const OTHER_ADMIN_ID = "00000000-0000-4000-8000-000000000502";

const superAdminHeaders = {
  "Content-Type": "application/json",
  ...authHeaders("neon-super-admin"),
};

const env = {
  DATABASE_URL: "postgresql://example.test/db",
  ...authTestEnv,
};

describe("super admin setup routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(installAuthFetchMock()),
    );
  });

  test("Super Admin can load setup users", async () => {
    const { default: app } = await import("../index");

    const response = await app.request(
      "/api/v1/super-admin/setup",
      { headers: superAdminHeaders },
      env,
    );

    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body).toMatchObject({
      success: true,
      data: {
        role: "SUPER_ADMIN",
        users: [
          {
            name: "Demo Manager",
            roles: ["MANAGER"],
          },
          {
            name: "Anika Sharma",
            roles: ["SALES_EXECUTIVE"],
          },
        ],
      },
    });
  });

  test("Manager cannot access Super Admin setup", async () => {
    const { default: app } = await import("../index");

    const response = await app.request(
      "/api/v1/super-admin/setup",
      {
        headers: {
          ...superAdminHeaders,
          ...authHeaders("neon-manager"),
        },
      },
      env,
    );

    expect(response.status).toBe(403);
  });

  test("Super Admin can create a user with a role", async () => {
    const { default: app } = await import("../index");

    const response = await app.request(
      "/api/v1/super-admin/users",
      {
        method: "POST",
        headers: superAdminHeaders,
        body: JSON.stringify({
          name: "New Executive",
          email: "new.executive@example.test",
          phone: "+919000000401",
          role: "SALES_EXECUTIVE",
        }),
      },
      env,
    );

    expect(response.status).toBe(201);

    const body = await response.json();

    expect(body).toMatchObject({
      success: true,
      data: {
        name: "New Executive",
        role: "SALES_EXECUTIVE",
        status: "active",
      },
    });
  });

  test("Super Admin can read a user's latest device", async () => {
    const { default: app } = await import("../index");
    const response = await app.request(
      `/api/v1/super-admin/users/${TARGET_USER_ID}/device`,
      { headers: superAdminHeaders },
      env,
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.device).toMatchObject({ label: "Samsung SM-G991B", model: "SM-G991B" });
  });

  // ── PATCH /super-admin/users/:id ────────────────────────────────────────────

  test("Super Admin edits a user's details and status", async () => {
    const { default: app } = await import("../index");

    const response = await app.request(
      `/api/v1/super-admin/users/${TARGET_USER_ID}`,
      {
        method: "PATCH",
        headers: superAdminHeaders,
        body: JSON.stringify({
          name: "Suresh",
          email: "suresh@x.com",
          phone: "+919000000009",
          status: "inactive",
        }),
      },
      env,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toMatchObject({ name: "Suresh", status: "inactive" });
  });

  test("editing rejects an unknown status", async () => {
    const { default: app } = await import("../index");

    const response = await app.request(
      `/api/v1/super-admin/users/${TARGET_USER_ID}`,
      {
        method: "PATCH",
        headers: superAdminHeaders,
        body: JSON.stringify({ name: "Suresh", status: "retired" }),
      },
      env,
    );

    expect(response.status).toBe(422);
  });

  test("editing 409s when the email belongs to someone else", async () => {
    const { default: app } = await import("../index");

    const response = await app.request(
      `/api/v1/super-admin/users/${TARGET_USER_ID}`,
      {
        method: "PATCH",
        headers: superAdminHeaders,
        body: JSON.stringify({ name: "Suresh", email: "taken@x.com", status: "active" }),
      },
      env,
    );

    expect(response.status).toBe(409);
  });

  test("a Manager cannot edit users", async () => {
    const { default: app } = await import("../index");

    const response = await app.request(
      `/api/v1/super-admin/users/${TARGET_USER_ID}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders("neon-manager") },
        body: JSON.stringify({ name: "Suresh", status: "active" }),
      },
      env,
    );

    expect(response.status).toBe(403);
  });

  // Passwords now live entirely in Neon Auth (set via the web /api/admin/set-password
  // BFF → Neon admin plugin). The API no longer has a password-set endpoint.

  // User deletion has been removed — accounts are kept and set inactive, never
  // destroyed (no DELETE /super-admin/users/:id endpoint).
});
