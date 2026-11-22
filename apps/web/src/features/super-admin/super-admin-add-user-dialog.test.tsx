import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/dialog", () => import("./super-admin-add-user.test-kit"));
vi.mock("@/components/ui/search-select", () => import("./super-admin-add-user.test-kit"));
vi.mock("@/lib/api-client", () => ({ errorMessage: (e: unknown, fb: string) => (e instanceof Error ? e.message : fb) }));

import { AddUserDialog } from "./super-admin-add-user-dialog";
import { base, fillForm, okUser } from "./super-admin-add-user.test-kit";

afterEach(() => vi.restoreAllMocks());

describe("AddUserDialog — create flow", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<AddUserDialog {...base()} open={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("creates a non-admin user, shows credentials, copies them, and closes via Done", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(okUser), { status: 200 }));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const p = base();
    render(<AddUserDialog {...p} />);
    fireEvent.click(screen.getByText("pick-Manager")); // exercises onSelect(v) truthy
    fireEvent.click(screen.getByText("pick-empty")); // onSelect("") → ignored
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Create credentials" }));
    expect(await screen.findByText("Credentials created")).toBeInTheDocument();
    expect(p.onUserCreated).toHaveBeenCalledWith(expect.objectContaining({ id: "u9", roles: ["SALES_EXECUTIVE"] }));
    fireEvent.click(screen.getByRole("button", { name: "Copy Credentials" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Copied!" })).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Password: Gen123"));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(p.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("clears the Copied! label after the 3s timeout", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(okUser), { status: 200 }));
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    render(<AddUserDialog {...base()} />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Create credentials" }));
    await act(async () => { await vi.runAllTimersAsync(); });
    fireEvent.click(screen.getByRole("button", { name: "Copy Credentials" }));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole("button", { name: "Copied!" })).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(screen.getByRole("button", { name: "Copy Credentials" })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("closes on Cancel and on onOpenChange(false), but ignores onOpenChange(true)", () => {
    const p = base();
    render(<AddUserDialog {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "dlg-open" })); // next=true → guard skips
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "dlg-close" }));
    expect(p.onOpenChange).toHaveBeenCalledTimes(2);
    expect(p.onOpenChange).not.toHaveBeenCalledWith(true);
  });
});
