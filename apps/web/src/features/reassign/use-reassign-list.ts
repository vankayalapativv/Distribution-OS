"use client";

import { useMemo, useState } from "react";
import type { ReassignCustomerRow } from "./reassign-api";

/** Search + owner-filter state over the already-loaded customer list (client-side,
 *  like the previous picker). Also derives the distinct owners for the filter. */
export function useReassignList(customers: ReassignCustomerRow[]) {
  const [search, setSearch] = useState("");
  const [owner, setOwner] = useState(""); // ownerId; "" = all owners

  const owners = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of customers) if (c.owner) m.set(c.owner.id, c.owner.name);
    return [...m].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [customers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (owner && c.owner?.id !== owner) return false;
      if (!q) return true;
      return (
        c.legalName.toLowerCase().includes(q) ||
        (c.customerCode ?? "").toLowerCase().includes(q) ||
        (c.city ?? "").toLowerCase().includes(q)
      );
    });
  }, [customers, search, owner]);

  return { search, setSearch, owner, setOwner, owners, filtered };
}
