import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { router } from "expo-router";

const useRemindersScreen = vi.fn();
vi.mock("../../lib/use-reminders-screen", () => ({ useRemindersScreen: () => useRemindersScreen() }));
vi.mock("../../components/reminders/assigned-row", () => ({ AssignedRow: ({ t }: { t: { id: string } }) => <span>assigned-{t.id}</span> }));
vi.mock("../../components/reminders/reminder-rows", () => ({
  PendingRow: ({ r, isOverdue }: { r: { id: string }; isOverdue: boolean }) => <span>{isOverdue ? "overdue" : "upcoming"}-{r.id}</span>,
  DoneRow: ({ r }: { r: { id: string } }) => <span>done-{r.id}</span>,
}));
vi.mock("../../components/reminders/followup-reminder-row", () => ({ FollowupReminderRow: ({ f }: { f: { customerId: string } }) => <span>fu-{f.customerId}</span> }));

import RemindersScreen from "./reminders";

const empty = { reminders: [], assigned: [], followups: [], now: 1000, refreshing: false, onRefresh: vi.fn(), onDone: vi.fn(), confirmDoneAssigned: vi.fn(), confirmDelete: vi.fn(), confirmDoneFollowup: vi.fn() };

describe("RemindersScreen", () => {
  it("shows the empty state and routes to New", () => {
    (router.push as ReturnType<typeof vi.fn>).mockClear();
    useRemindersScreen.mockReturnValue({ ...empty });
    render(<RemindersScreen />);
    expect(screen.getByText("No reminders yet")).toBeInTheDocument();
    fireEvent.click(screen.getByText("＋ New"));
    expect(router.push).toHaveBeenCalledWith("/reminder/new");
  });

  it("renders every section: assigned, follow-ups, overdue, upcoming, done", () => {
    useRemindersScreen.mockReturnValue({
      ...empty,
      assigned: [{ id: "as1" }],
      followups: [{ customerId: "c1" }],
      reminders: [
        { id: "od1", status: "pending", remindAt: 500 }, // overdue (<= now 1000)
        { id: "up1", status: "pending", remindAt: 2000 }, // upcoming (> now)
        { id: "dn1", status: "done", remindAt: 100 },
      ],
    });
    render(<RemindersScreen />);
    expect(screen.getByText("Assigned to you")).toBeInTheDocument();
    expect(screen.getByText("assigned-as1")).toBeInTheDocument();
    expect(screen.getByText("fu-c1")).toBeInTheDocument();
    expect(screen.getByText("overdue-od1")).toBeInTheDocument();
    expect(screen.getByText("upcoming-up1")).toBeInTheDocument();
    expect(screen.getByText("done-dn1")).toBeInTheDocument();
  });
});
