import { beforeEach, describe, expect, it, vi } from "vitest";

const ota = vi.hoisted(() => ({
  state: { installing: false, downloading: false, version: null as string | null, notes: [] as string[], pct: 0 },
}));
vi.mock("./update-gate-hook", () => ({ useOtaUpdate: () => ota.state }));

import { render, screen } from "@testing-library/react";
import { Text } from "react-native";
import { UpdateGate } from "./update-gate";

beforeEach(() => {
  ota.state = { installing: false, downloading: false, version: null, notes: [], pct: 0 };
});

describe("UpdateGate", () => {
  it("renders children with no overlay when idle", () => {
    render(<UpdateGate><Text>app</Text></UpdateGate>);
    expect(screen.getByText("app")).toBeInTheDocument();
    expect(screen.queryByText(/update/i)).not.toBeInTheDocument();
  });

  it("shows the overlay over the children while downloading", () => {
    ota.state = { installing: false, downloading: true, version: "2.0.0", notes: [], pct: 30 };
    render(<UpdateGate><Text>app</Text></UpdateGate>);
    expect(screen.getByText("app")).toBeInTheDocument(); // children stay mounted
    expect(screen.getByText("Downloading update")).toBeInTheDocument();
  });

  it("shows the overlay while installing", () => {
    ota.state = { installing: true, downloading: false, version: "2.0.0", notes: [], pct: 100 };
    render(<UpdateGate><Text>app</Text></UpdateGate>);
    expect(screen.getByText("Installing update")).toBeInTheDocument();
  });
});
