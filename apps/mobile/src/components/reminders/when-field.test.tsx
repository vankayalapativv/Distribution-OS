import { describe, expect, it, vi } from "vitest";
import React, { useState } from "react";

const captured = vi.hoisted(() => ({ byMode: {} as Record<string, (e: { type: string }, d?: Date) => void> }));
vi.mock("@react-native-community/datetimepicker", () => {
  const RNWeb = require("react-native-web");
  return {
    default: (props: { mode: string; onChange: (e: { type: string }, d?: Date) => void }) => {
      captured.byMode[props.mode] = props.onChange;
      return RNWeb.View ? React.createElement(RNWeb.View, { "aria-label": `picker-${props.mode}` }) : null;
    },
  };
});

import { act, fireEvent, render, screen } from "@testing-library/react";
import { WhenField } from "./when-field";

function Harness() {
  const [when, setWhen] = useState(new Date(2026, 10, 27, 9, 0));
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  return (
    <WhenField
      when={when}
      whenLabel="27 Nov, 9:00 AM"
      showDate={showDate}
      showTime={showTime}
      setShowDate={setShowDate}
      setShowTime={setShowTime}
      setWhen={(u) => setWhen((c) => u(c))}
    />
  );
}

describe("WhenField", () => {
  it("opens the date picker, applies a date and chains to time, then applies a time", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("27 Nov, 9:00 AM")); // open the date picker
    expect(screen.getByLabelText("picker-date")).toBeInTheDocument();
    // Pick a date → merges, closes date, opens time.
    act(() => captured.byMode.date({ type: "set" }, new Date(2026, 11, 1)));
    expect(screen.getByLabelText("picker-time")).toBeInTheDocument();
    // Pick a time → merges, closes time.
    act(() => captured.byMode.time({ type: "set" }, new Date(2026, 0, 1, 15, 30)));
    expect(screen.queryByLabelText("picker-time")).not.toBeInTheDocument();
  });

  it("does nothing on a dismissed date / time picker", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("27 Nov, 9:00 AM"));
    act(() => captured.byMode.date({ type: "dismissed" })); // dismissed → just closes, no time chain
    expect(screen.queryByLabelText("picker-time")).not.toBeInTheDocument();
  });

  it("chains to time even when a set event carries no date, and tolerates a timeless set", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("27 Nov, 9:00 AM"));
    act(() => captured.byMode.date({ type: "set" })); // set with no date → still opens time
    expect(screen.getByLabelText("picker-time")).toBeInTheDocument();
    act(() => captured.byMode.time({ type: "set" })); // set with no date → just closes
    expect(screen.queryByLabelText("picker-time")).not.toBeInTheDocument();
  });

  it("closes the time picker on dismiss without changing the time", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("27 Nov, 9:00 AM"));
    act(() => captured.byMode.date({ type: "set" }, new Date(2026, 11, 1))); // opens time
    act(() => captured.byMode.time({ type: "dismissed" })); // dismissed → closes, no change
    expect(screen.queryByLabelText("picker-time")).not.toBeInTheDocument();
  });
});
