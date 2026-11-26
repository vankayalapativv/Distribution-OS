import { describe, expect, it } from "vitest";
import { buildRows, HEADER_H, ROW_H, sectionLetter } from "./directory-rows";
import type { DirectoryCustomer } from "../customer-directory";

function cust(name: string, over: Partial<DirectoryCustomer> = {}): DirectoryCustomer {
  return { id: name, code: null, name, phone: null, address: null, city: null, ...over };
}

describe("sectionLetter", () => {
  it("buckets by the uppercased first letter, non-alpha → #", () => {
    expect(sectionLetter("balaji")).toBe("B");
    expect(sectionLetter("  city")).toBe("C");
    expect(sectionLetter("123 Store")).toBe("#");
    expect(sectionLetter("")).toBe("#");
  });
});

describe("buildRows", () => {
  it("sorts, buckets by letter (# last) and precomputes offsets", () => {
    const { rows, offsets, letterOffset, presentLetters } = buildRows(
      [cust("Zebra"), cust("Apple"), cust("42 Spares"), cust("Ant")],
      "",
      false,
    );
    // headers A then Z then # (non-alpha last); within A: Ant, Apple
    expect(rows.map((r) => (r.kind === "header" ? `#${r.letter}` : r.customer.name))).toEqual([
      "#A", "Ant", "Apple", "#Z", "Zebra", "##", "42 Spares",
    ]);
    expect(presentLetters).toEqual(new Set(["A", "Z", "#"]));
    expect(offsets[0]).toBe(0);
    expect(offsets[1]).toBe(HEADER_H); // first item after the A header
    expect(offsets[2]).toBe(HEADER_H + ROW_H);
    expect(letterOffset.get("A")).toBe(0);
  });

  it("filters by name / phone / code / city when searching", () => {
    const list = [
      cust("Balaji Auto", { phone: "9000", code: "C01", city: "Khammam" }),
      cust("City Garage", { phone: "8000", code: "C02", city: "Guntur" }),
    ];
    const names = (q: string) => buildRows(list, q, true).rows.filter((r) => r.kind === "item").map((r) => (r as { customer: DirectoryCustomer }).customer.name);
    expect(names("balaji")).toEqual(["Balaji Auto"]); // name
    expect(names("8000")).toEqual(["City Garage"]); // phone
    expect(names("c01")).toEqual(["Balaji Auto"]); // code
    expect(names("guntur")).toEqual(["City Garage"]); // city
    expect(names("zzz")).toEqual([]);
  });

  it("tolerates customers with null phone / code / city while searching", () => {
    // Query doesn't match the name, so the phone/code/city ?? "" fallbacks run.
    const { rows } = buildRows([cust("Bare Shop")], "zzz", true);
    expect(rows.filter((r) => r.kind === "item")).toHaveLength(0);
  });

  it("always sorts the non-alphabetic (#) bucket last", () => {
    const { rows } = buildRows([cust("9 Store"), cust("Apple"), cust("Cat"), cust("Banana")], "", false);
    const headers = rows.filter((r) => r.kind === "header").map((r) => (r as { letter: string }).letter);
    expect(headers).toEqual(["A", "B", "C", "#"]);
  });
});
