import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { router } from "expo-router";
import { CustomerRow, LetterHeader } from "./customer-row";
import type { DirectoryCustomer } from "../../lib/customer-directory";

const cust = (over: Partial<DirectoryCustomer> = {}): DirectoryCustomer =>
  ({ id: "c1", name: "Acme Traders", phone: "9876543210", city: "Hyderabad", ...over }) as DirectoryCustomer;

describe("LetterHeader", () => {
  it("renders the section letter", () => {
    render(<LetterHeader letter="A" />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });
});

describe("CustomerRow", () => {
  it("renders the name + subtitle + avatar initials and opens the customer", () => {
    (router.push as ReturnType<typeof vi.fn>).mockClear?.();
    render(<CustomerRow c={cust()} />);
    expect(screen.getByText("Acme Traders")).toBeInTheDocument();
    expect(screen.getByText("9876543210 · Hyderabad")).toBeInTheDocument();
    expect(screen.getByText("AT")).toBeInTheDocument(); // initials
    fireEvent.click(screen.getByText("Acme Traders"));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/customer/[id]", params: { id: "c1", name: "Acme Traders" } });
  });

  it("omits the subtitle when there is no phone or city", () => {
    render(<CustomerRow c={cust({ phone: null, city: null })} />);
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
  });
});
