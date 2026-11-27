import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PayCard } from "./pay-card";
import type { MyPay } from "../../lib/salary";

const pay = (over: Partial<MyPay> = {}): MyPay => ({ monthlySalary: 20000, advanceOutstanding: 0, thisMonth: null, ...over });

describe("PayCard", () => {
  it("renders nothing without a salary", () => {
    expect(render(<PayCard pay={null} />).container).toBeEmptyDOMElement();
    expect(render(<PayCard pay={pay({ monthlySalary: null })} />).container).toBeEmptyDOMElement();
  });

  it("shows the salary and a not-paid-yet note", () => {
    render(<PayCard pay={pay()} />);
    expect(screen.getByText("₹20,000")).toBeInTheDocument();
    expect(screen.getByText(/Not yet paid this month/)).toBeInTheDocument();
  });

  it("shows this month's net with the advance recovery", () => {
    render(<PayCard pay={pay({ thisMonth: { paid: true, gross: 20000, recovered: 10000, net: 10000 } })} />);
    expect(screen.getByText(/paid ₹10,000 \(after ₹10,000 advance recovery\)/)).toBeInTheDocument();
  });

  it("omits the recovery note when nothing was recovered", () => {
    render(<PayCard pay={pay({ thisMonth: { paid: true, gross: 20000, recovered: 0, net: 20000 } })} />);
    expect(screen.getByText(/paid ₹20,000/)).toBeInTheDocument();
    expect(screen.queryByText(/advance recovery/)).not.toBeInTheDocument();
  });
});
