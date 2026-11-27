import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FollowupReminderRow } from "./followup-reminder-row";

const followup = (over: Record<string, unknown> = {}) =>
  ({ followUpAt: "2026-11-27T04:00:00Z", customerName: "Acme", reason: "Discuss renewal", ...over }) as never;

describe("FollowupReminderRow", () => {
  it("marks an overdue follow-up as Due now and resolves it", () => {
    const onDone = vi.fn();
    render(<FollowupReminderRow f={followup()} now={Date.parse("2026-11-28T00:00:00Z")} onDone={onDone} />);
    expect(screen.getByText("Due now")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText(/Discuss renewal/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Done"));
    expect(onDone).toHaveBeenCalled();
  });

  it("hides the Due-now banner when the follow-up is still in the future", () => {
    render(<FollowupReminderRow f={followup()} now={Date.parse("2026-11-26T00:00:00Z")} onDone={() => {}} />);
    expect(screen.queryByText("Due now")).not.toBeInTheDocument();
  });
});
