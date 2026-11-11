/**
 * Pure logic for the Customers contacts list: filter → sort → flatten into a
 * [header, ...rows, header, ...rows] array with precomputed pixel offsets, so
 * FlatList's getItemLayout is O(1) and the A–Z jump (scrollToOffset) lands
 * exactly on a letter header every time.
 */
import type { DirectoryCustomer } from "../customer-directory";

// Fixed row/header heights (dp) — handed to FlatList via getItemLayout.
export const ROW_H = 64;
export const HEADER_H = 32;

/** Flattened list rows: a sticky letter header, or a customer row. */
export type Row =
  | { kind: "header"; letter: string }
  | { kind: "item"; customer: DirectoryCustomer };

/** Section bucket: first letter A–Z, or "#" for anything non-alphabetic. */
export function sectionLetter(name: string): string {
  const c = name.trim().charAt(0).toUpperCase();
  return c >= "A" && c <= "Z" ? c : "#";
}

export interface BuiltRows {
  rows: Row[];
  offsets: number[];
  letterOffset: Map<string, number>;
  presentLetters: Set<string>;
}

export function buildRows(
  customers: DirectoryCustomer[],
  query: string,
  searching: boolean,
): BuiltRows {
  const list = searching
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          (c.phone ?? "").includes(query) ||
          (c.code ?? "").toLowerCase().includes(query) ||
          (c.city ?? "").toLowerCase().includes(query),
      )
    : customers;

  const byLetter = new Map<string, DirectoryCustomer[]>();
  for (const c of [...list].sort((a, b) => a.name.localeCompare(b.name))) {
    const letter = sectionLetter(c.name);
    const bucket = byLetter.get(letter);
    if (bucket) bucket.push(c);
    else byLetter.set(letter, [c]);
  }
  const letters = [...byLetter.keys()].sort((a, b) => {
    if (a === "#") return 1;
    if (b === "#") return -1;
    return a.localeCompare(b);
  });

  const rows: Row[] = [];
  const offsets: number[] = [];
  const letterOffset = new Map<string, number>();
  const presentLetters = new Set<string>(letters);
  let y = 0;
  for (const letter of letters) {
    letterOffset.set(letter, y);
    rows.push({ kind: "header", letter });
    offsets.push(y);
    y += HEADER_H;
    for (const customer of byLetter.get(letter)!) {
      rows.push({ kind: "item", customer });
      offsets.push(y);
      y += ROW_H;
    }
  }
  return { rows, offsets, letterOffset, presentLetters };
}
