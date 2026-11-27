import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { router } from "expo-router";

const useAdminDues = vi.fn();
vi.mock("../../lib/use-admin-dues", () => ({ useAdminDues: () => useAdminDues() }));
vi.mock("../../components/admin/dues-exec-filter", () => ({ DuesExecFilter: () => null }));
vi.mock("../../components/admin/dues-bucket-selector", () => ({ DuesBucketSelector: () => <span>bucket-selector</span> }));
vi.mock("../../components/admin/dues-customer-list", () => ({ DuesCustomerList: () => <span>customer-list</span> }));

import AdminDuesScreen from "./dues";

const base = {
  execs: [], execsLoading: false, execId: null, setExecId: vi.fn(),
  refreshing: false, onRefresh: vi.fn(), error: null, loadSummary: vi.fn(),
  buckets: [], bucket: "0_30", setBucket: vi.fn(), loading: false,
  listLoading: false, customers: [],
};

describe("AdminDuesScreen", () => {
  it("renders the dues body and navigates back", () => {
    useAdminDues.mockReturnValue({ ...base });
    render(<AdminDuesScreen />);
    expect(screen.getByText("Collection dues")).toBeInTheDocument();
    expect(screen.getByText("bucket-selector")).toBeInTheDocument();
    expect(screen.getByText("customer-list")).toBeInTheDocument();
    fireEvent.click(screen.getByText("‹"));
    expect(router.back).toHaveBeenCalled();
  });

  it("shows an error with retry", () => {
    const loadSummary = vi.fn();
    useAdminDues.mockReturnValue({ ...base, error: new Error("x"), loadSummary });
    render(<AdminDuesScreen />);
    fireEvent.click(screen.getByText("Try again"));
    expect(loadSummary).toHaveBeenCalled();
    expect(screen.queryByText("bucket-selector")).not.toBeInTheDocument();
  });
});
