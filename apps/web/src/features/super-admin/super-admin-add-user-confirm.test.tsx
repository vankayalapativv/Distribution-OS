import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/dialog", () => import("./super-admin-add-user.test-kit"));
vi.mock("@/components/ui/search-select", () => import("./super-admin-add-user.test-kit"));
vi.mock("@/lib/api-client", () => ({ errorMessage: (e: unknown, fb: string) => (e instanceof Error ? e.message : fb) }));

import { AddUserDialog } from "./super-admin-add-user-dialog";
import { base, fillForm, okUser } from "./super-admin-add-user.test-kit";

afterEach(() => vi.restoreAllMocks());

describe("AddUserDialog — errors & Super Admin confirm", () => {
  it("shows a form error when creation fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: "dup phone" }), { status: 409 }));
    render(<AddUserDialog {...base()} />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Create credentials" }));
    expect(await screen.findByText("dup phone")).toBeInTheDocument();
  });

  it("falls back to a generic message when the error body has no `error`", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({}), { status: 500 }));
    render(<AddUserDialog {...base()} />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Create credentials" }));
    expect(await screen.findByText("User creation failed.")).toBeInTheDocument();
  });

  it("shows a created user whose email came back null (blank in the credentials)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ...okUser, email: null }), { status: 200 }));
    const p = base();
    render(<AddUserDialog {...p} />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Create credentials" }));
    expect(await screen.findByText("Credentials created")).toBeInTheDocument();
    expect(p.onUserCreated).toHaveBeenCalledWith(expect.objectContaining({ email: null }));
  });

  it("requires an explicit confirm for a SUPER_ADMIN, with a Back path", () => {
    const { container } = render(<AddUserDialog {...base()} />);
    fireEvent.click(screen.getByText("pick-Super Admin"));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Boss" } });
    fireEvent.submit(container.querySelector("form")!); // email blank → confirm shows "—"
    expect(screen.getByText("Create another Super Admin?")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument(); // null email
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByLabelText("Name")).toBeInTheDocument(); // back to the form
  });

  it("confirms and creates the SUPER_ADMIN", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ...okUser, role: "SUPER_ADMIN" }), { status: 200 }));
    render(<AddUserDialog {...base()} />);
    fireEvent.click(screen.getByText("pick-Super Admin"));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Boss" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "boss@x.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Create credentials" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, create Super Admin" }));
    expect(await screen.findByText("Credentials created")).toBeInTheDocument();
  });
});
