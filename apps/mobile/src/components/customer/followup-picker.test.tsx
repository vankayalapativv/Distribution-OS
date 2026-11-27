import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

const cards: Array<Record<string, unknown>> = [];
vi.mock("../datetime-picker", () => ({
  DateTimePickerCard: (props: Record<string, unknown>) => {
    cards.push(props);
    return null;
  },
}));

import { useFollowupPicker } from "./followup-picker";

function Harness({ opts, onResolved }: { opts?: Record<string, unknown>; onResolved: (v: string | null) => void }) {
  const { pickDateTime, sheet } = useFollowupPicker();
  return (
    <>
      <button onClick={() => void pickDateTime(opts).then(onResolved)}>open</button>
      {sheet}
    </>
  );
}

const latest = () => cards[cards.length - 1];

describe("useFollowupPicker", () => {
  it("resolves with the chosen ISO on confirm", async () => {
    const onResolved = vi.fn();
    const { getByText } = render(<Harness opts={{ title: "Pick", message: "Msg" }} onResolved={onResolved} />);
    fireEvent.click(getByText("open"));
    expect(latest().visible).toBe(true);
    expect(latest().title).toBe("Pick");
    (latest().onConfirm as (iso: string) => void)("2026-11-27T10:00:00Z");
    await Promise.resolve();
    expect(onResolved).toHaveBeenCalledWith("2026-11-27T10:00:00Z");
  });

  it("resolves null on cancel and uses default copy", async () => {
    const onResolved = vi.fn();
    const { getByText } = render(<Harness onResolved={onResolved} />);
    fireEvent.click(getByText("open"));
    expect(latest().title).toBe("Set a follow-up reminder?");
    (latest().onCancel as () => void)();
    await Promise.resolve();
    expect(onResolved).toHaveBeenCalledWith(null);
  });

  it("honours an explicit initial date", () => {
    const initial = new Date("2026-12-01T00:00:00Z");
    const { getByText } = render(<Harness opts={{ initial }} onResolved={vi.fn()} />);
    fireEvent.click(getByText("open"));
    expect((latest().initial as Date).toISOString()).toBe(initial.toISOString());
  });
});
