import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchSalesExecutives = vi.fn<(...a: unknown[]) => Promise<unknown>>();
vi.mock("../../lib/admin-dues", () => ({ fetchSalesExecutives: () => fetchSalesExecutives() }));

import { fireEvent, renderWithQuery, screen, waitFor } from "../../test/render-query";
import { SalesExecSelect } from "./sales-exec-select";

beforeEach(() => {
  fetchSalesExecutives.mockReset().mockResolvedValue([
    { id: "e1", name: "Asha" },
    { id: "e2", name: "Bina" },
  ]);
});

describe("SalesExecSelect", () => {
  it("shows the placeholder, a required marker and an error", () => {
    renderWithQuery(<SalesExecSelect value={null} valueName={null} onSelect={() => {}} required error="Pick one" />);
    expect(screen.getByText("Select executive")).toBeInTheDocument();
    expect(screen.getByText("*")).toBeInTheDocument();
    expect(screen.getByText("Pick one")).toBeInTheDocument();
  });

  it("shows the chosen name when set", () => {
    renderWithQuery(<SalesExecSelect value="e1" valueName="Asha" onSelect={() => {}} />);
    expect(screen.getByText("Asha")).toBeInTheDocument();
  });

  it("opens the picker, filters, and selects an executive", async () => {
    const onSelect = vi.fn();
    renderWithQuery(<SalesExecSelect value={null} valueName={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("Select executive")); // open the modal
    expect(await screen.findByText("Assign sales executive")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Bina")).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText("Search executive…"), { target: { value: "bin" } });
    await waitFor(() => expect(screen.queryByText("Asha")).not.toBeInTheDocument()); // filtered out
    fireEvent.click(screen.getByText("Bina"));
    expect(onSelect).toHaveBeenCalledWith("e2", "Bina");
  });
});
