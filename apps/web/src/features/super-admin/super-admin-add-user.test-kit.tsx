/* eslint-disable @typescript-eslint/no-explicit-any */
import { fireEvent, screen } from "@testing-library/react";
import { vi } from "vitest";

// Mock Dialog primitives (so onOpenChange can be driven with both values) and the
// SearchSelect (exposes a pick button per option + a `pick-empty`). Loaded by each
// add-user test file via `vi.mock(path, () => import("./super-admin-add-user.test-kit"))`.
export const Dialog = ({ open, onOpenChange, children }: any) =>
  open ? (
    <div>
      {children}
      <button onClick={() => onOpenChange(false)}>dlg-close</button>
      <button onClick={() => onOpenChange(true)}>dlg-open</button>
    </div>
  ) : null;
export const DialogContent = ({ children }: any) => <div>{children}</div>;
export const DialogHeader = ({ children }: any) => <div>{children}</div>;
export const DialogTitle = ({ children }: any) => <h2>{children}</h2>;
export const DialogDescription = ({ children }: any) => <p>{children}</p>;
export const DialogBody = ({ children }: any) => <div>{children}</div>;
export const DialogFooter = ({ children }: any) => <div>{children}</div>;
export const SearchSelect = (p: any) => (
  <div>
    <span>role:{p.valueKey}</span>
    {p.items.map((o: any) => (
      <button key={p.getKey(o)} onClick={() => p.onSelect(p.getKey(o))}>{`pick-${p.getLabel(o)}`}</button>
    ))}
    <button onClick={() => p.onSelect("")}>pick-empty</button>
  </div>
);

export const cfg = { apiBaseUrl: "x", authToken: "t" };
export const okUser = {
  id: "u9", name: "New Exec", email: "n@x.com", phone: "9", status: "active",
  appLoginId: "neon-9", role: "SALES_EXECUTIVE", generatedPassword: "Gen123",
};
export const base = () => ({ open: true, onOpenChange: vi.fn(), actionConfig: cfg, onUserCreated: vi.fn() });
export const fillForm = () => {
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New Exec" } });
  fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "+9199" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "n@x.com" } });
};
