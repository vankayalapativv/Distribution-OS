import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const useAuthGate = vi.fn();
vi.mock("../lib/use-auth-gate", () => ({ useAuthGate: () => useAuthGate() }));
vi.mock("./splash", () => ({ Splash: () => <span>splash</span> }));

import { AuthGate } from "./auth-gate";

describe("AuthGate", () => {
  it("mounts children and drops the splash once ready", () => {
    useAuthGate.mockReturnValue({ hydrated: true, started: true, revealed: true });
    render(<AuthGate><span>app</span></AuthGate>);
    expect(screen.getByText("app")).toBeInTheDocument();
    expect(screen.queryByText("splash")).not.toBeInTheDocument();
  });

  it("keeps the splash overlay while not yet ready (but mounts children once hydrated)", () => {
    useAuthGate.mockReturnValue({ hydrated: true, started: true, revealed: false });
    render(<AuthGate><span>app</span></AuthGate>);
    expect(screen.getByText("app")).toBeInTheDocument();
    expect(screen.getByText("splash")).toBeInTheDocument();
  });

  it("withholds children until the token has hydrated", () => {
    useAuthGate.mockReturnValue({ hydrated: false, started: false, revealed: false });
    render(<AuthGate><span>app</span></AuthGate>);
    expect(screen.queryByText("app")).not.toBeInTheDocument();
    expect(screen.getByText("splash")).toBeInTheDocument();
  });
});
