import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The select is the shared searchable SearchSelect. Mock it to a flat list of
// option buttons (+ a trigger showing the current value) so we can assert the
// items this component builds and the ids it emits.
vi.mock("@/components/ui/search-select", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SearchSelect: ({ items, valueKey, getKey, getLabel, onSelect, renderOption }: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const current = items.find((i: any) => getKey(i) === valueKey);
    return (
      <div>
        <div data-testid="value">{current ? getLabel(current) : ""}</div>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {items.map((it: any) => (
          <button key={getKey(it)} onClick={() => onSelect(getKey(it))}>
            {renderOption ? renderOption(it) : getLabel(it)}
          </button>
        ))}
      </div>
    );
  },
}));

import { TaskAssigneeSelect } from "./task-assignee-select";
import type { TaskAssignee } from "./tasks-api";

const office: TaskAssignee[] = [{ id: "u1", name: "Ravi", role: "MANAGER" }];
const se: TaskAssignee[] = [{ id: "s1", name: "Sandeep", role: "SALES_EXECUTIVE" }];

describe("TaskAssigneeSelect", () => {
  it("shows Unassigned by default, with every person and their role sub-label", () => {
    render(<TaskAssigneeSelect value="" onChange={() => {}} selectedAssignee={null} officeAssignees={office} seAssignees={se} />);
    expect(screen.getByTestId("value").textContent).toBe("Unassigned");
    expect(screen.getByText("Ravi")).toBeInTheDocument();
    expect(screen.getByText("Sandeep")).toBeInTheDocument();
    expect(screen.getByText("manager")).toBeInTheDocument(); // role label lower-cased
    expect(screen.getByText("sales executive")).toBeInTheDocument();
  });

  it("shows the selected assignee name", () => {
    render(<TaskAssigneeSelect value="u1" onChange={() => {}} selectedAssignee={office[0]} officeAssignees={office} seAssignees={se} />);
    expect(screen.getByTestId("value").textContent).toBe("Ravi");
  });

  it("emits the id, and '' for the Unassigned option", () => {
    const onChange = vi.fn();
    render(<TaskAssigneeSelect value="" onChange={onChange} selectedAssignee={null} officeAssignees={office} seAssignees={se} />);
    fireEvent.click(screen.getByText("Sandeep"));
    expect(onChange).toHaveBeenCalledWith("s1");
    fireEvent.click(screen.getByRole("button", { name: "Unassigned" }));
    expect(onChange).toHaveBeenCalledWith("");
  });
});
