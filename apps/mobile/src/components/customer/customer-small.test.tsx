import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { router } from "expo-router";
import { CustomerTopBar } from "./top-bar";
import { SectionError, SectionTitle } from "./section-bits";
import { ChipSelect } from "./chip-select";
import { Field } from "./field";
import { CustomerSkeleton } from "./customer-skeleton";

describe("CustomerTopBar", () => {
  it("renders name/code and navigates back + edit", () => {
    (router.back as ReturnType<typeof vi.fn>).mockClear?.();
    (router.push as ReturnType<typeof vi.fn>).mockClear?.();
    render(<CustomerTopBar id="c1" name="Acme" code="C1" />);
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("C1")).toBeInTheDocument();
    fireEvent.click(screen.getByText("‹"));
    expect(router.back).toHaveBeenCalled();
    fireEvent.click(screen.getByText("✎ Edit"));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/customer/edit", params: { id: "c1", name: "Acme" } });
  });

  it("renders without a code", () => {
    render(<CustomerTopBar id="c1" name="Acme" code={null} />);
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.queryByText("C1")).not.toBeInTheDocument();
  });
});

describe("section-bits", () => {
  it("SectionTitle renders; SectionError retries", () => {
    render(<SectionTitle>Last 5 orders</SectionTitle>);
    expect(screen.getByText("Last 5 orders")).toBeInTheDocument();
    const onRetry = vi.fn();
    render(<SectionError label="Couldn't load" onRetry={onRetry} />);
    fireEvent.click(screen.getByText("Try again"));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe("ChipSelect", () => {
  it("renders options with a required marker + error and toggles", () => {
    const onToggle = vi.fn();
    render(
      <ChipSelect
        label="Segments"
        required
        error="Pick one"
        options={[{ value: "car", label: "Car" }, { value: "2w", label: "2W" }]}
        isOn={(v) => v === "car"}
        onToggle={onToggle}
      />,
    );
    expect(screen.getByText("*")).toBeInTheDocument();
    expect(screen.getByText("Pick one")).toBeInTheDocument();
    fireEvent.click(screen.getByText("2W"));
    expect(onToggle).toHaveBeenCalledWith("2w");
  });

  it("renders without a required marker or error", () => {
    render(
      <ChipSelect
        label="Segments"
        options={[{ value: "car", label: "Car" }]}
        isOn={() => false}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.queryByText("*")).not.toBeInTheDocument();
    expect(screen.getByText("Car")).toBeInTheDocument();
  });
});

describe("Field", () => {
  it("edits, shows a required marker + error", () => {
    const onChange = vi.fn();
    render(<Field label="Name" value="" onChange={onChange} required error="Required" placeholder="Your name" />);
    expect(screen.getByText("Required")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Your name"), { target: { value: "Acme" } });
    expect(onChange).toHaveBeenCalledWith("Acme");
  });

  it("renders a read-only email field", () => {
    render(<Field label="Email" value="a@b.com" onChange={() => {}} keyboardType="email-address" editable={false} />);
    expect(screen.getByDisplayValue("a@b.com")).toBeInTheDocument();
  });

  it("renders a multiline field", () => {
    render(<Field label="Notes" value="hi" onChange={() => {}} multiline maxLength={200} />);
    expect(screen.getByDisplayValue("hi")).toBeInTheDocument();
  });
});

describe("CustomerSkeleton", () => {
  it("renders", () => {
    const { container } = render(<CustomerSkeleton />);
    expect(container.querySelector("div")).not.toBeNull();
  });
});
